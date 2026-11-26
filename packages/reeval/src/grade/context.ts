import { readFile } from 'node:fs/promises'
import { globFilter } from '../environment.ts'
import { canonicalJson } from '../eval-source.ts'
import type { Trajectory } from '../history/trajectory.ts'
import { sha256 } from '../ids.ts'
import type { Case, GradeReads, HostFile, JSONValue } from '../types.ts'
import type { GradeRun } from './define.ts'
import type { GraderContext, GraderData, GraderTurn } from './types.ts'

/** What an attempt's graders read: its case and turns, and what it left. */
export type GradeInputs = {
  case: Case
  turns: readonly GraderTurn[]
  trajectory: Trajectory
  /** The skills the attempt's environment placed, by name. */
  skills: readonly string[]
}

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
  data: GradeRun['data'],
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

/** `c` for one grade call, and what it read. */
export function graderContext(
  inputs: GradeInputs,
  run: GradeRun,
  data: GraderData,
  signal: AbortSignal,
): { c: GraderContext; reads: GradeReads } {
  const { trajectory } = inputs
  const observations = new Map<string, { name: string; sha256: string }>()
  const artifacts = new Map<string, { name: string; sha256: string }>()
  const files = new Map<string, { path: string; sha256: string }>()
  const mayRead = readable(run.files)
  const who = run.names.length === 1 ? `grader ${run.names[0]}` : `graders ${run.names.join(', ')}`
  function observation(name: string, options?: { optional: true }): JSONValue | undefined {
    const found = trajectory.observations.find((o) => o.name === name)
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
    execs: trajectory.execs,
    changedFiles: trajectory.changedFiles,
    skills: inputs.skills,
    observation: observation as GraderContext['observation'],
    async artifact(name) {
      const ref = trajectory.artifacts.find((a) => a.name === name)
      const png = ref && (await trajectory.readArtifact(name))
      if (!ref || !png) throw new GradeError(`the attempt has no capture named "${name}"`)
      artifacts.set(name, { name, sha256: ref.sha256 })
      return { name, png, ...(ref.capture ? { capture: ref.capture } : {}) }
    },
    async readFile(given) {
      const path = workspacePath(given)
      if (path === undefined || !mayRead(path)) {
        throw new GradeError(
          `${who} can't read ${JSON.stringify(given)}: it isn't in its files (${run.files.length ? run.files.join(', ') : 'none'}). Add it to files.`,
        )
      }
      if (!trajectory.workspace) {
        throw new GradeError(`the attempt kept no workspace, so ${path} can't be read`)
      }
      const entry = trajectory.workspace.manifest.files.find((f) => f.path === path)
      const bytes = await trajectory.workspace.readFile(path)
      if (!entry || bytes === null) {
        throw new MissingFileError(`the attempt's workspace has no file ${path}`)
      }
      files.set(path, { path, sha256: entry.sha256 ?? sha256(bytes) })
      return bytes.toString('utf8')
    },
    decisions: trajectory.decisions,
    data,
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
