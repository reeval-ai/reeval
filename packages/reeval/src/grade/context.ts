import { readFile } from 'node:fs/promises'
import { shellQuote } from '@reeval/sandbox-docker/process'
import { globFilter } from '../environment.ts'
import { canonicalJson } from '../eval-source.ts'
import type { StoredAttempt } from '../history/stored-attempt.ts'
import { sha256 } from '../ids.ts'
import type { DraftSource } from '../judge/draft.ts'
import type { Sandbox } from '../sandbox/types.ts'
import type { Case, GradeReads, HostFile, JSONValue } from '../types.ts'
import type { CodeRun } from './define.ts'
import type { GradeJudge } from './judge.ts'
import type { SandboxStarter } from './sandbox.ts'
import type { GraderContext, GraderData, GraderSandbox, GraderTurn } from './types.ts'

/** What an attempt's graders read: its case and turns, and what it left. */
export type GradeInputs = {
  case: Case
  turns: readonly GraderTurn[]
  stored: StoredAttempt
  /** The skills the attempt's environment placed, by name. */
  skills: readonly string[]
  /** Starts a grader's `env` sandbox; a grader with `env` errors without it. */
  sandboxes?: SandboxStarter
  /**
   * Each turn's subagent runs, which a judge's `transcript` shows under their spawn calls. A
   * regrade rebuilds them from the record's `subagents` and `transcript.jsonl`.
   */
  subagents?: ReadonlyArray<DraftSource['subagents']>
  /** How judge graders ask; without it they error. */
  judge?: GradeJudge
}

type FileRead = { path: string; sha256: string }

/** A grader's error that names what it did wrong, as the grade's `error` gives it. */
export class GradeError extends Error {
  override name = 'GradeError'
}

/** `c.readFile` on a path the kept workspace doesn't have. */
export class MissingFileError extends GradeError {
  override name = 'MissingFileError'
}

/** Whether `files` lets a grader read `path`: some include pattern matches, and the last one wins. */
export function readable(files: readonly string[]): (path: string) => boolean {
  if (!files.some((p) => !p.startsWith('!'))) return () => false
  const keep = globFilter(files)
  return (path) => keep(path)
}

/** A workspace path as the manifest lists it: relative, with `/`, no `.` or `..` steps. */
function workspacePath(path: string): string | undefined {
  if (typeof path !== 'string' || !path || path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
    return undefined
  }
  const steps = path
    .replaceAll('\\', '/')
    .split('/')
    .filter((s) => s && s !== '.')
  return steps.includes('..') || !steps.length ? undefined : steps.join('/')
}

/** The grader's `data` files' content, and its digest. */
export async function readData(
  data: CodeRun['data'],
): Promise<{ data: GraderData; digest?: string }> {
  const entries = Object.entries(data)
  if (!entries.length) return { data: {} }
  const read = (f: HostFile) => readFile(f.path, 'utf8')
  const out: GraderData = {}
  const hashed: Array<[string, string | Array<[string, string]>]> = []
  for (const [key, value] of entries) {
    if (value.kind === 'file' && typeof value.path === 'string') {
      const text = await read(value as HostFile)
      out[key] = text
      hashed.push([key, sha256(text)])
      continue
    }
    const files = Object.entries(value as Record<string, HostFile>)
    const texts = await Promise.all(files.map(([, f]) => read(f)))
    out[key] = Object.fromEntries(files.map(([path], i) => [path, texts[i] as string]))
    hashed.push([key, files.map(([path], i) => [path, sha256(texts[i] as string)])])
  }
  return { data: out, digest: sha256(canonicalJson(hashed)) }
}

const who = (run: CodeRun) =>
  run.names.length === 1 ? `grader ${run.names[0]}` : `graders ${run.names.join(', ')}`

/**
 * Copies the kept workspace's files that `run`'s `files` let it read into `box`'s workspace, and
 * returns them as read. A grader with `files` and no kept workspace is a `GradeError`.
 */
export async function copyFiles(
  inputs: GradeInputs,
  run: CodeRun,
  box: Sandbox,
  signal: AbortSignal,
): Promise<FileRead[]> {
  const { workspace } = inputs.stored
  const mayRead = readable(run.files)
  if (!workspace) {
    if (!run.files.some((p) => !p.startsWith('!'))) return []
    throw new GradeError(
      `the attempt kept no workspace, so ${who(run)} has no files to copy into its sandbox`,
    )
  }
  const entries = workspace.manifest.files.filter((f) => f.target === undefined && mayRead(f.path))
  const files = await Promise.all(
    entries.map(async (f) => ({ path: f.path, content: await workspace.readFile(f.path) })),
  )
  const { writeFiles } = await import('../attempt/session.ts')
  await writeFiles(
    box,
    files.flatMap((f) => (f.content ? [{ path: f.path, content: f.content }] : [])),
    signal,
  )
  const executable = entries.filter((f) => f.executable).map((f) => shellQuote(f.path))
  if (executable.length) {
    const done = await box.exec(`chmod +x ${executable.join(' ')}`, { signal })
    if (done.exitCode !== 0) throw new Error(`chmod +x failed: ${done.stderr.trim()}`)
  }
  return entries.map((f, i) => ({
    path: f.path,
    sha256: f.sha256 ?? sha256(files[i]?.content ?? ''),
  }))
}

/** `box` as `c.sandbox`, each command stopped with the grade. */
function graderSandbox(box: Sandbox | undefined, run: CodeRun, signal: AbortSignal): GraderSandbox {
  if (!box) {
    const none = async (): Promise<never> => {
      throw new GradeError(`${who(run)} has no env, so it has no c.sandbox. Give it env: docker().`)
    }
    return { exec: none, readFile: none, writeFile: none }
  }
  return {
    exec: (command, options) => box.exec(command, { ...options, signal }),
    readFile: (path) => box.readFile(path),
    writeFile: (path, content) => box.writeFile(path, content),
  }
}

/** `c` for one grade call, and what it read: with `sandbox`, the files copied into it. */
export function graderContext(
  inputs: GradeInputs,
  run: CodeRun,
  data: GraderData,
  signal: AbortSignal,
  sandbox?: { box: Sandbox; copied: readonly FileRead[] },
): { c: GraderContext; reads: GradeReads } {
  const { stored } = inputs
  const observations = new Map<string, { name: string; sha256: string }>()
  const artifacts = new Map<string, { name: string; sha256: string }>()
  const files = new Map<string, FileRead>(sandbox?.copied.map((f) => [f.path, f]))
  const mayRead = readable(run.files)
  function observation(name: string, options?: { optional: true }): JSONValue | undefined {
    const found = stored.observations.find((o) => o.name === name)
    if (!found) {
      if (options?.optional) return undefined
      throw new GradeError(
        `the attempt made no c.observe("${name}", …). Pass { optional: true } to read it as undefined.`,
      )
    }
    observations.set(name, { name, sha256: found.sha256 ?? sha256(JSON.stringify(found.value)) })
    return found.value
  }
  const c: GraderContext = {
    case: inputs.case,
    turns: inputs.turns,
    execs: stored.execs,
    changedFiles: stored.changedFiles,
    skills: inputs.skills,
    observation: observation as GraderContext['observation'],
    async artifact(name) {
      const ref = stored.artifacts.find((a) => a.name === name)
      const png = ref && (await stored.readArtifact(name))
      if (!ref || !png) throw new GradeError(`the attempt has no capture named "${name}"`)
      artifacts.set(name, { name, sha256: ref.sha256 })
      return { name, png, ...(ref.capture ? { capture: ref.capture } : {}) }
    },
    async readFile(given) {
      const path = workspacePath(given)
      if (path === undefined || !mayRead(path)) {
        throw new GradeError(
          `${who(run)} can't read ${JSON.stringify(given)}: it isn't in its files (${run.files.length ? run.files.join(', ') : 'none'}). Add it to files.`,
        )
      }
      if (!stored.workspace) {
        throw new GradeError(`the attempt kept no workspace, so ${path} can't be read`)
      }
      const entry = stored.workspace.manifest.files.find((f) => f.path === path)
      const bytes = await stored.workspace.readFile(path)
      if (!entry || bytes === null) {
        throw new MissingFileError(`the attempt's workspace has no file ${path}`)
      }
      files.set(path, { path, sha256: entry.sha256 ?? sha256(bytes) })
      return bytes.toString('utf8')
    },
    decisions: stored.decisions,
    data,
    sandbox: graderSandbox(sandbox?.box, run, signal),
    signal,
  }
  const reads = (): GradeReads => ({
    ...(observations.size ? { observations: [...observations.values()] } : {}),
    ...(artifacts.size ? { artifacts: [...artifacts.values()] } : {}),
    ...(files.size ? { files: [...files.values()] } : {}),
  })
  return {
    c,
    get reads() {
      return reads()
    },
  }
}
