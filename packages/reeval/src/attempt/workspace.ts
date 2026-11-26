// The final workspace, kept whole: archived in the sandbox from the files git doesn't ignore,
// fetched in pieces, then masked and scanned entry by entry as it streams through on the host and
// written gzipped, with a manifest of each file's hash, beside the attempt's staging record. The
// run's assembly moves both into the attempt's directory.
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, open, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip, createGzip } from 'node:zlib'
import {
  OPAQUE_OUTPUT,
  readTarStream,
  TAR_END,
  type TarEntry,
  tarEntry,
} from '@reeval/sandbox-docker'
import { shellQuote } from '@reeval/sandbox-docker/process'
import { debugLog } from '../debug/attempt.ts'
import { keptArchiveCommand } from '../diff.ts'
import {
  WORKSPACE_ARCHIVE,
  WORKSPACE_LIMIT,
  WORKSPACE_MANIFEST,
  WORKSPACE_RAW_LIMIT,
  type WorkspaceFile,
  type WorkspaceManifest,
} from '../history/types.ts'
import { recordFileName, sha256 } from '../ids.ts'
import type { Sandbox } from '../sandbox/index.ts'
import type { KeptWorkspace } from '../types.ts'
import { formatBytes } from '../view/debug.ts'
import { observedFileBytes } from './observe.ts'
import { cleanEntry, EXCLUDED_DIRS, EXCLUDED_FIND, excludedDirs, listed } from './snapshot.ts'
import type { Attempt } from './state.ts'

const WORKSPACE_TIMEOUT_MS = 300_000
const SIZE_MARK = '--reeval-size--'
/** How much of the archive one command fetches from the sandbox. */
const FETCH_CHUNK = 8 * 2 ** 20

export type WorkspaceLimits = { tar: number; raw: number }

const LIMITS: WorkspaceLimits = { tar: WORKSPACE_LIMIT, raw: WORKSPACE_RAW_LIMIT }

/** Where an attempt's kept workspace waits, beside its staging record, until the run is assembled. */
export const workspaceSidecar = (stagingDir: string, key: string) =>
  join(stagingDir, 'evals', recordFileName(key).replace(/\.json$/, '.workspace'))

/** A regular file's or symbolic link's manifest entry; null for a directory. */
function fileOf(e: TarEntry): WorkspaceFile | null {
  if (e.type === 'file') {
    return {
      path: e.path,
      sha256: sha256(e.data),
      bytes: e.data.length,
      ...(e.mode & 0o100 ? { executable: true as const } : {}),
    }
  }
  if (e.type !== 'symlink') return null
  const target = Buffer.from(e.target)
  return { path: e.path, sha256: sha256(target), bytes: target.length, target: e.target }
}

/** `files` as a manifest: sorted by path, the last of any path given twice. */
const manifestFrom = (files: WorkspaceFile[]): WorkspaceManifest => ({
  schemaVersion: 1,
  files: [...new Map(files.map((f) => [f.path, f])).values()].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  ),
})

const none = (cause: 'size' | 'error', message: string, dirs: string[] = []): KeptWorkspace => ({
  files: 0,
  bytes: 0,
  excluded: listed(dirs),
  masked: [],
  dropped: [],
  skipped: { cause, message },
})

class TooLarge extends Error {
  override name = 'TooLarge'
}

/** Copies the sandbox's file `path`, `size` bytes, to `target` on the host, a piece at a time. */
async function fetchFile(
  box: Sandbox,
  path: string,
  size: number,
  target: string,
  signal: AbortSignal,
): Promise<void> {
  const out = await open(target, 'w')
  try {
    for (let at = 0; at < size; at += FETCH_CHUNK) {
      // Opaque, so a debug trace of the command counts the archive rather than keeping it unmasked.
      const r = await box.execOwn(
        `echo ${OPAQUE_OUTPUT}; dd if=${path} bs=${FETCH_CHUNK} skip=${at / FETCH_CHUNK} count=1 2>/dev/null | base64`,
        { signal },
      )
      const encoded = r.stdout.startsWith(`${OPAQUE_OUTPUT}\n`)
        ? r.stdout.slice(OPAQUE_OUTPUT.length + 1)
        : ''
      const piece = Buffer.from(encoded, 'base64')
      if (r.exitCode !== 0 || piece.length === 0) {
        throw new Error(`couldn't read the archive back: ${r.stderr.trim() || 'no output'}`)
      }
      await out.write(piece)
    }
  } finally {
    await out.close()
  }
}

type Cleaned = {
  files: WorkspaceFile[]
  masked: string[]
  dropped: string[]
  excluded: string[]
  bytes: number
  sha256: string
}

/**
 * Streams the gzipped tar at `source` into `target`, each entry masked or dropped as it goes, and
 * hashed as it's written; a `TooLarge` past either limit.
 */
async function cleanStream(
  source: string,
  target: string,
  limits: WorkspaceLimits,
  signal: AbortSignal,
): Promise<Cleaned> {
  const out: Cleaned = { files: [], masked: [], dropped: [], excluded: [], bytes: 0, sha256: '' }
  const left = new Set<string>()
  const gunzip = createGunzip()
  // A read or gunzip error reaches the loop below through `gunzip`; the tar reader stops at the
  // archive's end, before the padding after it, which closes `gunzip` early.
  pipeline(createReadStream(source), gunzip, { signal }).catch(() => {})
  let raw = 0
  async function* plain() {
    for await (const chunk of gunzip as AsyncIterable<Buffer>) {
      raw += chunk.length
      if (raw > limits.raw) throw new TooLarge('raw')
      yield chunk
    }
  }
  async function* kept() {
    for await (const e of readTarStream(plain())) {
      const c = cleanEntry(e)
      if ('excluded' in c) left.add(c.excluded)
      else if ('dropped' in c) out.dropped.push(c.dropped)
      else {
        if (c.masked) out.masked.push(c.kept.path)
        const f = fileOf(c.kept)
        if (f) out.files.push(f)
        yield tarEntry(c.kept)
      }
    }
    yield TAR_END
  }
  const hash = createHash('sha256')
  try {
    await pipeline(
      Readable.from(kept()),
      createGzip(),
      async function* (chunks: AsyncIterable<Buffer>) {
        for await (const chunk of chunks) {
          out.bytes += chunk.length
          if (out.bytes > limits.tar) throw new TooLarge('tar')
          hash.update(chunk)
          yield chunk
        }
      },
      createWriteStream(target),
      { signal },
    )
  } finally {
    gunzip.destroy()
  }
  out.sha256 = hash.digest('hex')
  out.excluded = [...left]
  return out
}

/**
 * Keeps the workspace as the attempt left it in `dir` and adds what it kept to the record; never
 * fails the attempt. Adds nothing when the attempt's signal stopped it. Its archive shares the
 * attempt's 100 MiB beside its record with its large observed values.
 */
export async function keepWorkspace(
  a: Attempt,
  box: Sandbox,
  dir: string,
  limits: WorkspaceLimits = LIMITS,
  timeoutMs = WORKSPACE_TIMEOUT_MS,
): Promise<void> {
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = AbortSignal.any([a.signal, timeout])
  const gz = shellQuote(`${box.stateDir}/kept.tar.gz`)
  const observed = observedFileBytes(a)
  const tarLimit = limits.tar - observed
  const cap = `the ${formatBytes(tarLimit)} cap${observed ? ` left beside ${formatBytes(observed)} of large observed values` : ''}`
  const add = (kept: KeptWorkspace & { sha256?: string }) => {
    if (a.signal.aborted) return
    if (kept.skipped) debugLog('teardown', `workspace not kept: ${kept.skipped.message}`)
    a.record.workspace = kept
  }
  let dirs: string[] = []
  const without = () => (dirs.length ? dirs.join(', ') : 'its ignored, dependency and cache files')
  try {
    await rm(dir, { recursive: true, force: true })
    const sized = await box.execOwn(
      `cd ${shellQuote(box.workdir)} && { ${EXCLUDED_FIND}; echo ${SIZE_MARK}; } && ` +
        `${keptArchiveCommand(box, gz, EXCLUDED_DIRS)} && wc -c < ${gz}`,
      { signal },
    )
    const [found = '', size = ''] = sized.stdout.split(`${SIZE_MARK}\n`)
    dirs = excludedDirs(found)
    const gzBytes = Number(size.trim())
    if (sized.exitCode !== 0 || !(gzBytes > 0)) {
      return add(
        none('error', `couldn't archive the workspace: ${(sized.stderr || sized.stdout).trim()}`),
      )
    }
    if (gzBytes > tarLimit) {
      return add(
        none(
          'size',
          `the workspace is ${formatBytes(gzBytes)} compressed without ${without()}, over ${cap}`,
          dirs,
        ),
      )
    }
    await mkdir(dir, { recursive: true })
    const fetched = join(dir, 'fetched.tar.gz')
    await fetchFile(box, gz, gzBytes, fetched, signal)
    let clean: Cleaned
    try {
      clean = await cleanStream(
        fetched,
        join(dir, WORKSPACE_ARCHIVE),
        { ...limits, tar: tarLimit },
        signal,
      )
    } catch (error) {
      if (!(error instanceof TooLarge)) throw error
      await rm(dir, { recursive: true, force: true })
      return add(
        none(
          'size',
          error.message === 'raw'
            ? `the workspace is over ${formatBytes(limits.raw)} uncompressed without ${without()}, the most reeval masks`
            : `the workspace is over ${cap} compressed`,
          dirs,
        ),
      )
    } finally {
      await rm(fetched, { force: true })
    }
    const manifest = manifestFrom(clean.files)
    await writeFile(join(dir, WORKSPACE_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)
    const kept = {
      files: manifest.files.length,
      bytes: clean.bytes,
      excluded: listed([...new Set([...dirs, ...clean.excluded])].sort()),
      masked: listed(clean.masked),
      dropped: listed(clean.dropped),
      skipped: null,
      sha256: clean.sha256,
    }
    const masked = kept.masked.length ? ` · masked ${kept.masked.length}` : ''
    const dropped = kept.dropped.length ? ` · dropped ${kept.dropped.length}` : ''
    debugLog(
      'teardown',
      `workspace kept: ${kept.files} files, ${formatBytes(kept.bytes)} compressed${masked}${dropped}`,
    )
    add(kept)
  } catch (error) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    if (a.signal.aborted) return
    const message = timeout.aborted
      ? `it took over ${Math.round(timeoutMs / 1000)}s`
      : error instanceof Error
        ? error.message
        : String(error)
    add(none('error', `couldn't archive the workspace: ${message}`, dirs))
  } finally {
    if (!a.signal.aborted) {
      await box.execOwn(`rm -f ${gz}`, { signal: AbortSignal.timeout(30_000) }).catch(() => {})
    }
  }
}
