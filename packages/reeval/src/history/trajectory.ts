// What an attempt left for grading, read back from its run's directory (`.reeval/runs/<run>/` or
// the history folder's `<run>/`): its `c.exec` results, observations, captures and final
// workspace. Every file is checked against the hash its record holds.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { readTar } from '@reeval/sandbox-docker'
import { sha256 } from '../ids.ts'
import type { Observation } from '../types.ts'
import { readableExecLine, readableWorkspaceManifest } from '../view/record.ts'
import { HistoryError } from './files.ts'
import {
  type ArtifactRef,
  type AttemptRecord,
  type ExecLine,
  type FileRef,
  WORKSPACE_RAW_LIMIT,
  type WorkspaceManifest,
} from './types.ts'

export type KeptFiles = {
  /** Each file and symbolic link kept, sorted by path. */
  manifest: WorkspaceManifest
  /**
   * A kept regular file's content, as kept (masked); null for a path it didn't keep. The archive
   * is read on the first call.
   */
  readFile(path: string): Promise<Buffer | null>
}

export type Trajectory = {
  /** Each foreground `c.exec`, in call order; empty for a record from before `files.execs`. */
  execs: ExecLine[]
  /** The last value of each `c.observe` name, in first-call order. */
  observations: Observation[]
  /** Each capture's PNG, by name. */
  artifacts: ArtifactRef[]
  /** A capture's PNG, or null when the attempt has none by that name. */
  readArtifact(name: string): Promise<Buffer | null>
  /** The final workspace; null when the attempt didn't keep one. */
  workspace: KeptFiles | null
}

/** `ref`'s file in `runDir`, refused when it isn't what the record says. */
export async function readRef(runDir: string, ref: FileRef): Promise<Buffer> {
  const bytes = await readFile(join(runDir, ...ref.path.split('/')))
  if (sha256(bytes) !== ref.sha256) {
    throw new HistoryError(`${ref.path} changed since the run wrote it`)
  }
  return bytes
}

/** The attempt's `execs.jsonl`, line by line. */
export async function readExecs(runDir: string, attempt: AttemptRecord): Promise<ExecLine[]> {
  const ref = attempt.files.execs
  if (!ref) return []
  return (await readRef(runDir, ref))
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => readableExecLine(JSON.parse(line)))
}

/** The attempt's kept workspace, or null when it has none. */
export async function readKeptFiles(
  runDir: string,
  attempt: AttemptRecord,
): Promise<KeptFiles | null> {
  const { workspace, workspaceManifest } = attempt.files
  if (!workspace || !workspaceManifest) return null
  const manifest = readableWorkspaceManifest(
    JSON.parse((await readRef(runDir, workspaceManifest)).toString('utf8')),
    workspaceManifest.path,
  )
  let files: Promise<Map<string, Buffer>> | undefined
  const load = async () => {
    const tar = gunzipSync(await readRef(runDir, workspace), {
      maxOutputLength: WORKSPACE_RAW_LIMIT,
    })
    return new Map(readTar(tar).flatMap((e) => (e.type === 'file' ? [[e.path, e.data]] : [])))
  }
  return {
    manifest,
    async readFile(path) {
      if (!manifest.files.some((f) => f.path === path && f.target === undefined)) return null
      files ??= load()
      return (await files).get(path) ?? null
    },
  }
}

/** What `attempt` left for grading, from its run's directory `runDir`. */
export async function readTrajectory(runDir: string, attempt: AttemptRecord): Promise<Trajectory> {
  const artifacts = attempt.files.artifacts ?? []
  return {
    execs: await readExecs(runDir, attempt),
    observations: attempt.observations ?? [],
    artifacts,
    async readArtifact(name) {
      const ref = artifacts.find((a) => a.name === name)
      return ref ? readRef(runDir, ref) : null
    },
    workspace: await readKeptFiles(runDir, attempt),
  }
}
