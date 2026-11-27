// What a trial left for grading, read back from its run's directory (`.reeval/runs/<run>/` or
// the history folder's `<run>/`): its `c.exec` results, observations, `c.decide` calls, captures
// and final workspace. Every file is checked against the hash its record holds. A kept workspace
// is never read whole: each file streams out of its archive when it's asked for.
import { createReadStream } from 'node:fs'
import { readFile, rename, rm } from 'node:fs/promises'
import { join, posix } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import { readTarStream } from '@reeval/sandbox-docker'
import { safeZipPath } from '../archive/zip.ts'
import { randomSuffix, sha256 } from '../ids.ts'
import type { DecisionRecord, FileChange, JSONValue, Observation } from '../types.ts'
import {
  readableDecisionLine,
  readableExecLine,
  readableWorkspaceManifest,
} from '../view/record.ts'
import { HistoryError, isMissing, sha256File } from './files.ts'
import {
  type ArtifactRef,
  type TrialRecord,
  type ExecLine,
  type FileRef,
  WORKSPACE_RAW_LIMIT,
  type WorkspaceFile,
  type WorkspaceManifest,
} from './types.ts'

/** The most symbolic links one path is followed through, as Linux's own limit. */
const MAX_LINKS = 40

export type KeptFiles = {
  /** Each file and symbolic link kept, sorted by path. */
  manifest: WorkspaceManifest
  /**
   * A kept regular file's content, as kept (masked), following symbolic links that stay inside
   * the workspace; null for a path it didn't keep or a link that leaves it. The archive's hash is
   * checked on the first call.
   */
  readFile(path: string): Promise<Buffer | null>
}

export type ReadKeptOptions = {
  /**
   * Fetches the archive into `file` when it isn't in `runDir`, as a run in a remote store's copy:
   * `fetchWorkspace` (`src/store/sync.ts`) for `s3()`.
   */
  fetch?: (ref: FileRef, file: string) => Promise<void>
}

export type StoredTrial = {
  /** Each foreground `c.exec`, in call order; empty for a record from before `files.execs`. */
  execs: ExecLine[]
  /** The last value of each `c.observe` name, in first-call order, each value read back. */
  observations: Observation[]
  /** Each `c.decide` call, in call order. */
  decisions: DecisionRecord[]
  /** Each capture's PNG, by name. */
  artifacts: ArtifactRef[]
  /** A capture's PNG, or null when the trial has none by that name. */
  readArtifact(name: string): Promise<Buffer | null>
  /** The final workspace; null when the trial didn't keep one. */
  workspace: KeptFiles | null
  /** The final diff's files. */
  changedFiles: FileChange[]
  /**
   * The workspace diff as the record keeps it: each file's part capped, noise dropped, and each
   * dependency directory one entry with its file count.
   */
  diff: { patch: string; files: Array<FileChange & { count?: number }> }
}

/** `ref`'s file in `runDir`, as a path; refused when it's absolute or climbs out. */
function refFile(runDir: string, ref: FileRef): string {
  if (safeZipPath(ref.path) !== ref.path) {
    throw new HistoryError(`${ref.path} isn't a path inside the run`)
  }
  return join(runDir, ...ref.path.split('/'))
}

/** `ref`'s file in `runDir`, refused when it isn't what the record says. */
export async function readRef(runDir: string, ref: FileRef): Promise<Buffer> {
  const bytes = await readFile(refFile(runDir, ref))
  if (sha256(bytes) !== ref.sha256) {
    throw new HistoryError(`${ref.path} changed since the run wrote it`)
  }
  return bytes
}

/** The trial's `execs.jsonl`, line by line. */
export async function readExecs(runDir: string, trial: TrialRecord): Promise<ExecLine[]> {
  const ref = trial.files.execs
  if (!ref) return []
  return (await readRef(runDir, ref))
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => readableExecLine(JSON.parse(line)))
}

/**
 * `path` with every symbolic link in it followed through `files`, or null when one points outside
 * the workspace, or the path doesn't end at a kept regular file.
 */
function resolveLinks(files: Map<string, WorkspaceFile>, path: string): string | null {
  let rest = path.split('/')
  let at: string[] = []
  let links = 0
  while (rest.length) {
    const part = rest.shift() as string
    const here = [...at, part].join('/')
    const target = files.get(here)?.target
    if (target === undefined) {
      at.push(part)
      continue
    }
    if (++links > MAX_LINKS || target.startsWith('/')) return null
    const joined = posix.normalize(posix.join(posix.dirname(here), target))
    if (joined === '..' || joined.startsWith('../')) return null
    rest = [...(joined === '.' ? [] : joined.split('/')), ...rest]
    at = []
  }
  const resolved = at.join('/')
  const file = files.get(resolved)
  return file && file.target === undefined ? resolved : null
}

/** The file at `path` in the gzipped tar `archive`, streamed until it's found. */
async function fromArchive(archive: string, path: string): Promise<Buffer | null> {
  const gunzip = createGunzip()
  // Errors reach the loop through `gunzip`, which it closes once it has the file.
  pipeline(createReadStream(archive), gunzip).catch(() => {})
  let raw = 0
  async function* capped() {
    for await (const chunk of gunzip as AsyncIterable<Buffer>) {
      raw += chunk.length
      if (raw > WORKSPACE_RAW_LIMIT) throw new HistoryError(`${archive} is over its size cap`)
      yield chunk
    }
  }
  try {
    for await (const e of readTarStream(capped())) {
      if (e.path === path && e.type === 'file') return e.data
    }
    return null
  } finally {
    gunzip.destroy()
  }
}

/** The trial's `decisions.jsonl`, line by line. */
export async function readDecisions(
  runDir: string,
  trial: TrialRecord,
): Promise<DecisionRecord[]> {
  const ref = trial.files.decisions
  if (!ref) return []
  return (await readRef(runDir, ref))
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => readableDecisionLine(JSON.parse(line)))
}

/** The trial's kept workspace, or null when it has none. */
export async function readKeptFiles(
  runDir: string,
  trial: TrialRecord,
  options: ReadKeptOptions = {},
): Promise<KeptFiles | null> {
  const { workspace, workspaceManifest } = trial.files
  if (!workspace || !workspaceManifest) return null
  const manifest = readableWorkspaceManifest(
    JSON.parse((await readRef(runDir, workspaceManifest)).toString('utf8')),
    workspaceManifest.path,
  )
  const archive = refFile(runDir, workspace)
  const check = async () => {
    let hash = await sha256File(archive).catch((error) => {
      if (!isMissing(error) || !options.fetch) throw error
      return null
    })
    if (hash === null && options.fetch) {
      const tmp = `${archive}.${randomSuffix(6)}`
      try {
        await options.fetch(workspace, tmp)
        hash = await sha256File(tmp)
        if (hash === workspace.sha256) await rename(tmp, archive)
      } finally {
        await rm(tmp, { force: true })
      }
    }
    if (hash !== workspace.sha256) {
      throw new HistoryError(`${workspace.path} changed since the run wrote it`)
    }
  }
  return keptFiles(manifest, archive, check)
}

/**
 * A kept workspace from its manifest and its archive's path; `check` runs once, before the first
 * file is read from it.
 */
export function keptFiles(
  manifest: WorkspaceManifest,
  archive: string,
  check: () => Promise<void> = async () => {},
): KeptFiles {
  const byPath = new Map(manifest.files.map((f) => [f.path, f]))
  let checked: Promise<void> | undefined
  return {
    manifest,
    async readFile(path) {
      const resolved = resolveLinks(byPath, path)
      if (resolved === null) return null
      checked ??= check()
      await checked
      return fromArchive(archive, resolved)
    },
  }
}

/** Each observation with its value, read from its file when the record keeps it there. */
async function observedValues(runDir: string, trial: TrialRecord): Promise<Observation[]> {
  const out: Observation[] = []
  for (const o of trial.observations ?? []) {
    out.push(
      o.file
        ? { ...o, value: JSON.parse((await readRef(runDir, o.file)).toString('utf8')) as JSONValue }
        : o,
    )
  }
  return out
}

/** What `trial` left for grading, from its run's directory `runDir`. */
export async function readStoredTrial(
  runDir: string,
  trial: TrialRecord,
  options: ReadKeptOptions = {},
): Promise<StoredTrial> {
  const artifacts = trial.files.artifacts ?? []
  return {
    execs: await readExecs(runDir, trial),
    observations: await observedValues(runDir, trial),
    decisions: await readDecisions(runDir, trial),
    artifacts,
    async readArtifact(name) {
      const ref = artifacts.find((a) => a.name === name)
      return ref ? readRef(runDir, ref) : null
    },
    workspace: await readKeptFiles(runDir, trial, options),
    changedFiles: (trial.changedFiles ?? []).map(({ path, status }) => ({ path, status })),
    diff: {
      patch: trial.files.diff ? (await readRef(runDir, trial.files.diff)).toString('utf8') : '',
      files: diffFiles(trial.changedFiles ?? []),
    },
  }
}

/** The changed files as a grader's judge sees them, a dependency directory with its count. */
export const diffFiles = (changed: TrialRecord['changedFiles']): StoredTrial['diff']['files'] =>
  changed.map(({ path, status, count }) => ({ path, status, ...(count ? { count } : {}) }))
