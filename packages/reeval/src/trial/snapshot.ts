// Snapshots of the trial's workspace: archived in the sandbox, then filtered and masked on the
// host and written as a directory or a `.tar.gz` beside the trial's staging record, so what
// lands on disk went through the same secret masking as everything else reeval writes. The run's
// assembly moves them into the trial's directory in `.reeval/runs`.
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { extractTar, OPAQUE_OUTPUT, readTar, type TarEntry, writeTar } from '@reeval/sandbox-docker'
import { shellQuote } from '@reeval/sandbox-docker/process'
import { debugLog } from '../debug/trial.ts'
import { asText, scanBytes } from '../history/secret-scan.ts'
import { recordFileName } from '../ids.ts'
import { findSecrets, redactSecrets } from '../redact.ts'
import type { Sandbox } from '../sandbox/index.ts'
import type { Snapshot } from '../types.ts'
import { type DebugPhase, formatBytes } from '../view/debug.ts'
import type { Trial } from './state.ts'

/** The most a snapshot directory's files may add up to; a larger one isn't taken. */
export const SNAPSHOT_DIR_LIMIT = 50 * 2 ** 20
/** The most a compressed snapshot may be. */
export const SNAPSHOT_TAR_LIMIT = 10 * 2 ** 20
/** The most a compressed snapshot may be uncompressed, which the host holds in memory to mask. */
export const SNAPSHOT_RAW_LIMIT = 200 * 2 ** 20
/** How long one snapshot may take before the trial goes on without it. */
const SNAPSHOT_TIMEOUT_MS = 120_000

/** Installed dependencies, caches and git's objects: left out by directory name, at any depth. */
export const EXCLUDED_DIRS = [
  '.git',
  'node_modules',
  '.pnpm-store',
  '.venv',
  'venv',
  '.tox',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.parcel-cache',
  '.cache',
  '.dart_tool',
  '.gradle',
]

const LISTED = 50
const SIZE_MARK = '--reeval-size--'

const excluded = (path: string) => path.split('/').some((part) => EXCLUDED_DIRS.includes(part))

/** What becomes of one archive entry: kept (masked or not), dropped, or under an excluded directory. */
export type Cleaned =
  | { kept: TarEntry; masked: boolean }
  | { dropped: string }
  | { excluded: string }

/**
 * One entry of the sandbox's archive as it's kept: secret-looking values masked in a text file,
 * and dropped where masking can't reach (a binary or UTF-16 file the secret scan finds one in, or
 * a secret in its path).
 */
export function cleanEntry(e: TarEntry): Cleaned {
  if (excluded(e.path)) {
    const parts = e.path.split('/')
    const at = parts.findIndex((p) => EXCLUDED_DIRS.includes(p))
    return { excluded: redactSecrets(`${parts.slice(0, at + 1).join('/')}/`) }
  }
  if (findSecrets(e.path).length || (e.type === 'symlink' && findSecrets(e.target).length)) {
    return { dropped: redactSecrets(e.path) }
  }
  if (e.type !== 'file') return { kept: e, masked: false }
  const text = asText(e.data)
  if (text === null) {
    return scanBytes(e.path, e.data).length ? { dropped: e.path } : { kept: e, masked: false }
  }
  const clean = redactSecrets(text)
  if (clean === text) return { kept: e, masked: false }
  return { kept: { ...e, data: Buffer.from(clean) }, masked: true }
}

/** The sandbox's archive, with the excluded directories gone and secret-looking values masked. */
export function cleanArchive(tar: Buffer): {
  entries: TarEntry[]
  masked: string[]
  dropped: string[]
  excluded: string[]
} {
  const entries: TarEntry[] = []
  const masked: string[] = []
  const dropped: string[] = []
  const left = new Set<string>()
  for (const e of readTar(tar)) {
    const c = cleanEntry(e)
    if ('excluded' in c) left.add(c.excluded)
    else if ('dropped' in c) dropped.push(c.dropped)
    else {
      entries.push(c.kept)
      if (c.masked) masked.push(c.kept.path)
    }
  }
  return { entries, masked, dropped, excluded: [...left] }
}

const tarCommand = (workdir: string) => {
  const flags = EXCLUDED_DIRS.map((d) => `--exclude=${shellQuote(d)}`).join(' ')
  return `cd ${shellQuote(workdir)} && COPYFILE_DISABLE=1 tar -cf - ${flags} . 2>/dev/null`
}
const GZIP = 'if command -v gzip >/dev/null 2>&1; then gzip -c; else cat; fi'
const NEEDS_TAR =
  "command -v tar >/dev/null 2>&1 || { echo 'the sandbox has no tar' >&2; exit 127; }"

export const listed = (paths: string[]) => paths.slice(0, LISTED)

/** A `find` printing the directories left out by name under the current one, at most `LISTED`. */
export const EXCLUDED_FIND = `find . -type d \\( ${EXCLUDED_DIRS.map((d) => `-name ${shellQuote(d)}`).join(' -o ')} \\) -prune -print 2>/dev/null | head -n ${LISTED}`

/** `EXCLUDED_FIND`'s output as the record lists it. */
export const excludedDirs = (found: string) =>
  found
    .split('\n')
    .filter(Boolean)
    .map((p) => redactSecrets(`${p.replace(/^\.\//, '')}/`))

export type SnapshotLimits = {
  /** The directory form's cap on its files. */
  dir: number
  /** The compressed form's cap on the tarball. */
  tar: number
  /** The compressed form's cap uncompressed. */
  raw: number
}

const LIMITS: SnapshotLimits = {
  dir: SNAPSHOT_DIR_LIMIT,
  tar: SNAPSHOT_TAR_LIMIT,
  raw: SNAPSHOT_RAW_LIMIT,
}

type Taken = Omit<Snapshot, 'name' | 'path' | 'form'>

/**
 * Archives the sandbox's workspace and returns what to record and the masked entries to write,
 * or why none: over its form's cap, or an archive the sandbox couldn't make.
 */
export async function archiveWorkspace(
  box: Sandbox,
  signal: AbortSignal,
  compress: boolean,
  limits: SnapshotLimits = LIMITS,
): Promise<{ taken: Taken; entries: TarEntry[] | null }> {
  const none = (cause: 'size' | 'error', message: string, dirs: string[] = []) => ({
    taken: {
      bytes: 0,
      files: 0,
      excluded: listed(dirs),
      masked: [],
      dropped: [],
      skipped: { cause, message },
    },
    entries: null,
  })
  const tar = tarCommand(box.workdir)
  const sized = await box.execOwn(
    `${NEEDS_TAR}; cd ${shellQuote(box.workdir)} && { ${EXCLUDED_FIND}; echo ${SIZE_MARK}; ${tar} | wc -c; echo ${SIZE_MARK}; ${tar} | { ${GZIP}; } | wc -c; }`,
    { signal },
  )
  const [list = '', raw = '', size = ''] = sized.stdout.split(`${SIZE_MARK}\n`)
  const dirs = excludedDirs(list)
  const rawBytes = Number(raw.trim())
  const gzBytes = Number(size.trim())
  if (sized.exitCode !== 0 || !(rawBytes > 0) || !(gzBytes > 0)) {
    return none('error', `couldn't archive the workspace: ${(sized.stderr || sized.stdout).trim()}`)
  }
  const without = dirs.length ? dirs.join(', ') : 'its dependency and cache directories'
  const rawLimit = compress ? limits.raw : limits.dir
  if (rawBytes > rawLimit) {
    return none(
      'size',
      `the workspace is ${formatBytes(rawBytes)} without ${without}, over the ${formatBytes(rawLimit)} cap${compress ? '' : ` (compressed, the cap is ${formatBytes(limits.tar)})`}`,
      dirs,
    )
  }
  if (compress && gzBytes > limits.tar) {
    return none(
      'size',
      `the workspace is ${formatBytes(gzBytes)} compressed without ${without}, over the ${formatBytes(limits.tar)} cap`,
      dirs,
    )
  }
  // Opaque, so a debug trace of the command counts the archive rather than keeping it unmasked.
  const r = await box.execOwn(
    `${NEEDS_TAR}; echo ${OPAQUE_OUTPUT}; ${tar} | { ${GZIP}; } | base64`,
    { signal },
  )
  const encoded = r.stdout.startsWith(`${OPAQUE_OUTPUT}\n`)
    ? r.stdout.slice(OPAQUE_OUTPUT.length + 1)
    : ''
  const fetched = Buffer.from(encoded, 'base64')
  if (r.exitCode !== 0 || fetched.length === 0) {
    return none('error', `couldn't archive the workspace: ${r.stderr.trim() || 'no output'}`)
  }
  const plain =
    fetched[0] === 0x1f && fetched[1] === 0x8b
      ? gunzipSync(fetched, { maxOutputLength: rawLimit + 2 ** 20 })
      : fetched
  const clean = cleanArchive(plain)
  const all = [...new Set([...dirs, ...clean.excluded])].sort()
  return {
    taken: {
      bytes: 0,
      files: clean.entries.filter((e) => e.type !== 'dir').length,
      excluded: listed(all),
      masked: listed(clean.masked),
      dropped: listed(clean.dropped),
      skipped: null,
    },
    entries: clean.entries,
  }
}

/** Where a trial's snapshots wait, beside its staging record, until the run is assembled. */
export const snapshotSidecar = (stagingDir: string, key: string) =>
  join(stagingDir, 'evals', recordFileName(key).replace(/\.json$/, '.snapshots'))

/**
 * Takes snapshot `name` of the workspace into the trial's sidecar and adds it to the record;
 * never fails the trial. Adds nothing when the trial's signal stopped it.
 */
export async function takeSnapshot(
  a: Trial,
  box: Sandbox,
  name: string,
  phase: DebugPhase,
  limits: SnapshotLimits = LIMITS,
  timeoutMs = SNAPSHOT_TIMEOUT_MS,
): Promise<void> {
  const { compress } = a.spec.snapshot
  const form = compress ? 'tar.gz' : 'dir'
  const dir = a.snapshotDir
  const target = join(dir, compress ? `${name}.tar.gz` : name)
  const timeout = AbortSignal.timeout(timeoutMs)
  const add = (taken: Taken) => {
    a.record.snapshots ??= []
    a.record.snapshots.push({ name, form, path: null, ...taken })
  }
  const failed = (message: string) => {
    debugLog(phase, `no ${name} snapshot: ${message}`)
    add({
      bytes: 0,
      files: 0,
      excluded: [],
      masked: [],
      dropped: [],
      skipped: { cause: 'error', message: `couldn't archive the workspace: ${message}` },
    })
  }
  try {
    const { taken, entries } = await archiveWorkspace(
      box,
      AbortSignal.any([a.signal, timeout]),
      compress,
      limits,
    )
    if (!entries) {
      debugLog(phase, `no ${name} snapshot: ${taken.skipped?.message}`)
      add(taken)
      return
    }
    await rm(target, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    if (compress) {
      const archive = gzipSync(writeTar(entries))
      if (archive.length > limits.tar) {
        const message = `the workspace is ${formatBytes(archive.length)} compressed, over the ${formatBytes(limits.tar)} cap`
        debugLog(phase, `no ${name} snapshot: ${message}`)
        add({ ...taken, files: 0, skipped: { cause: 'size', message } })
        return
      }
      await writeFile(target, archive)
      taken.bytes = archive.length
    } else {
      const skipped = await extractTar(entries, target)
      taken.bytes = entries.reduce((n, e) => n + (e.type === 'file' ? e.data.length : 0), 0)
      taken.dropped = listed([...taken.dropped, ...skipped])
    }
    const masked = taken.masked.length ? ` · masked ${taken.masked.length}` : ''
    const left = taken.excluded.length ? ` · left out ${taken.excluded.join(', ')}` : ''
    debugLog(
      phase,
      `${name} snapshot: ${taken.files} files, ${formatBytes(taken.bytes)} (${form})${masked}${left}`,
    )
    add(taken)
  } catch (error) {
    await rm(target, { recursive: true, force: true }).catch(() => {})
    if (a.signal.aborted) return
    if (timeout.aborted) return failed(`it took over ${Math.round(timeoutMs / 1000)}s`)
    failed(error instanceof Error ? error.message : String(error))
  }
}
