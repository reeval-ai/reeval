// The final workspace, kept whole: archived in the sandbox from the files git doesn't ignore, then
// masked on the host and written gzipped, with a manifest of each file's hash, beside the attempt's
// staging record. The run's assembly moves both into the attempt's directory.
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { OPAQUE_OUTPUT, type TarEntry, writeTar } from '@reeval/sandbox-docker'
import { shellQuote } from '@reeval/sandbox-docker/process'
import { debugLog } from '../debug/attempt.ts'
import { keptFilesCommand } from '../diff.ts'
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
import {
  cleanArchive,
  EXCLUDED_DIRS,
  EXCLUDED_FIND,
  excludedDirs,
  GZIP,
  listed,
  NEEDS_TAR,
} from './snapshot.ts'
import type { Attempt } from './state.ts'

const WORKSPACE_TIMEOUT_MS = 300_000
const SIZE_MARK = '--reeval-size--'

export type WorkspaceLimits = { tar: number; raw: number }

const LIMITS: WorkspaceLimits = { tar: WORKSPACE_LIMIT, raw: WORKSPACE_RAW_LIMIT }

/** Where an attempt's kept workspace waits, beside its staging record, until the run is assembled. */
export const workspaceSidecar = (stagingDir: string, key: string) =>
  join(stagingDir, 'evals', recordFileName(key).replace(/\.json$/, '.workspace'))

/** Each file and symbolic link among `entries`, sorted by path. */
export function manifestOf(entries: TarEntry[]): WorkspaceManifest {
  const files: WorkspaceFile[] = []
  for (const e of entries) {
    if (e.type === 'file') {
      files.push({
        path: e.path,
        sha256: sha256(e.data),
        bytes: e.data.length,
        ...(e.mode & 0o100 ? { executable: true as const } : {}),
      })
    } else if (e.type === 'symlink') {
      const target = Buffer.from(e.target)
      files.push({ path: e.path, sha256: sha256(target), bytes: target.length, target: e.target })
    }
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { schemaVersion: 1, files }
}

const none = (cause: 'size' | 'error', message: string, dirs: string[] = []): KeptWorkspace => ({
  files: 0,
  bytes: 0,
  excluded: listed(dirs),
  masked: [],
  dropped: [],
  skipped: { cause, message },
})

/**
 * Keeps the workspace as the attempt left it in `dir` and adds what it kept to the record; never
 * fails the attempt. Adds nothing when the attempt's signal stopped it.
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
  const state = (name: string) => shellQuote(`${box.stateDir}/${name}`)
  const [list, tar, gz] = [state('kept-files'), state('kept.tar'), state('kept.tar.gz')]
  const add = (kept: KeptWorkspace & { sha256?: string }) => {
    if (a.signal.aborted) return
    if (kept.skipped) debugLog('teardown', `workspace not kept: ${kept.skipped.message}`)
    a.record.workspace = kept
  }
  try {
    await rm(dir, { recursive: true, force: true })
    const sized = await box.execOwn(
      `${NEEDS_TAR}; cd ${shellQuote(box.workdir)} && { ${EXCLUDED_FIND}; echo ${SIZE_MARK}; } && ` +
        `${keptFilesCommand(box, list, EXCLUDED_DIRS)} && ` +
        `COPYFILE_DISABLE=1 tar --null --no-recursion -cf ${tar} -T ${list} && ` +
        `{ ${GZIP}; } < ${tar} > ${gz} && rm -f ${tar} ${list} && wc -c < ${gz}`,
      { signal },
    )
    const [found = '', size = ''] = sized.stdout.split(`${SIZE_MARK}\n`)
    const dirs = excludedDirs(found)
    const gzBytes = Number(size.trim())
    if (sized.exitCode !== 0 || !(gzBytes > 0)) {
      return add(
        none('error', `couldn't archive the workspace: ${(sized.stderr || sized.stdout).trim()}`),
      )
    }
    const without = dirs.length ? dirs.join(', ') : 'its ignored, dependency and cache files'
    if (gzBytes > limits.tar) {
      return add(
        none(
          'size',
          `the workspace is ${formatBytes(gzBytes)} compressed without ${without}, over the ${formatBytes(limits.tar)} cap`,
          dirs,
        ),
      )
    }
    // Opaque, so a debug trace of the command counts the archive rather than keeping it unmasked.
    const r = await box.execOwn(`echo ${OPAQUE_OUTPUT}; base64 < ${gz}`, { signal })
    const encoded = r.stdout.startsWith(`${OPAQUE_OUTPUT}\n`)
      ? r.stdout.slice(OPAQUE_OUTPUT.length + 1)
      : ''
    const fetched = Buffer.from(encoded, 'base64')
    if (r.exitCode !== 0 || fetched.length === 0) {
      return add(none('error', `couldn't archive the workspace: ${r.stderr.trim() || 'no output'}`))
    }
    let plain: Buffer
    try {
      plain =
        fetched[0] === 0x1f && fetched[1] === 0x8b
          ? gunzipSync(fetched, { maxOutputLength: limits.raw })
          : fetched
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      return add(
        none(
          'size',
          `the workspace is over ${formatBytes(limits.raw)} without ${without}, the most reeval masks`,
          dirs,
        ),
      )
    }
    const clean = cleanArchive(plain)
    const manifest = manifestOf(clean.entries)
    const archive = gzipSync(writeTar(clean.entries))
    if (archive.length > limits.tar) {
      return add(
        none(
          'size',
          `the workspace is ${formatBytes(archive.length)} compressed, over the ${formatBytes(limits.tar)} cap`,
          dirs,
        ),
      )
    }
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, WORKSPACE_ARCHIVE), archive)
    await writeFile(join(dir, WORKSPACE_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)
    const kept = {
      files: manifest.files.length,
      bytes: archive.length,
      excluded: listed([...new Set([...dirs, ...clean.excluded])].sort()),
      masked: listed(clean.masked),
      dropped: listed(clean.dropped),
      skipped: null,
      sha256: sha256(archive),
    }
    const masked = kept.masked.length ? ` · masked ${kept.masked.length}` : ''
    debugLog(
      'teardown',
      `workspace kept: ${kept.files} files, ${formatBytes(kept.bytes)} compressed${masked}`,
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
    add(none('error', `couldn't archive the workspace: ${message}`))
  } finally {
    if (!a.signal.aborted) {
      await box
        .execOwn(`rm -f ${list} ${tar} ${gz}`, { signal: AbortSignal.timeout(30_000) })
        .catch(() => {})
    }
  }
}
