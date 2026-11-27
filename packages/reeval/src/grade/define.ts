import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { policyProblem } from '../contract/plain.ts'
import { got } from '../contract/shared.ts'
import { parseDuration } from '../duration.ts'
import { unenforceable } from '../egress.ts'
import { callerFile, DefinitionError, helpersFor, isHostFile, toPath } from '../environment.ts'
import { UsageError } from '../errors.ts'
import { canonicalJson } from '../eval-source.ts'
import { sha256 } from '../ids.ts'
import { isObjectLike } from '../object.ts'
import type {
  EgressPolicy,
  HostFile,
  JSONValue,
  PlannedEgress,
  SandboxDescriptor,
} from '../types.ts'
import type { BuiltinDef } from './builtins.ts'
import { functionDigest } from './digest.ts'
import { type JudgeRun, judgeRunOf, judgeScore, judgeScoreOf } from './judge.ts'
import type {
  Grader,
  GraderContext,
  GraderGroupSpec,
  GraderHelpers,
  GraderSpec,
  JudgeGraderSpec,
} from './types.ts'

export const GRADER = Symbol.for('reeval.grader')

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/
const KEYS = [
  'grade',
  'score',
  'weight',
  'required',
  'files',
  'data',
  'env',
  'egress',
  'revision',
  'timeout',
]
const JUDGE_KEYS = ['judge', 'score', 'weight', 'required', 'revision', 'timeout']
const DEFAULT_TIMEOUT = '5m'
const ENV_KINDS = ['docker', 'fake']

/** A grader's `env`: the sandbox `grade` runs in, and its network. */
export type GraderEnv = { sandbox: SandboxDescriptor; egress: PlannedEgress }

/** What a grader runs once per trial: its `grade` call, or its judge's question. */
export type GradeRun = CodeRun | JudgeRun

/** One `grade` call per trial, which a `defineGraders` group's members share. */
export type CodeRun = {
  kind: 'code'
  grade: (c: GraderContext) => unknown
  /** Every member's name: one for `defineGrader`. */
  names: string[]
  files: string[]
  data: Record<string, HostFile | Record<string, HostFile>>
  env?: GraderEnv
  revision?: number
  timeoutMs: number
  gradeDigest: string
}

/** One grader's own part of a run. */
export type GraderDef = {
  name: string
  run: GradeRun
  score?: (grade: never) => number
  scoreDigest?: string
  weight: number
  required: boolean
  /** Set on `reeval/graders`' built-ins. */
  builtin?: BuiltinDef
}

/** A grader's definition, from whichever copy of reeval made it; undefined for anything else. */
export function graderDef(value: unknown): GraderDef | undefined {
  return isObjectLike(value) && GRADER in value ? (value[GRADER] as GraderDef) : undefined
}

type Input<S> = S | ((helpers: GraderHelpers) => S)

function specOf<S>(
  input: Input<S>,
  where: string,
  base: string,
  judgeAllowed = false,
): Record<string, unknown> {
  const spec =
    typeof input === 'function' ? (input as (h: GraderHelpers) => S)(pick(helpersFor(base))) : input
  if (!isObjectLike(spec) || Array.isArray(spec)) {
    throw new DefinitionError(
      `${where} takes a spec, e.g. { grade: (c) => … } (got ${typeof spec})`,
    )
  }
  if ('judge' in spec && judgeAllowed) {
    if ('grade' in spec) throw new DefinitionError(`${where} takes grade or judge, not both`)
    const unknown = Object.keys(spec).filter((k) => !JUDGE_KEYS.includes(k))
    if (unknown.length) {
      throw new DefinitionError(
        `${where} doesn't take ${unknown.join(', ')}. A judge grader takes ${JUDGE_KEYS.join(', ')}.`,
      )
    }
    return spec
  }
  const unknown = Object.keys(spec).filter((k) => !KEYS.includes(k))
  if (unknown.length) {
    throw new DefinitionError(
      `${where} doesn't take ${unknown.join(', ')}. A grader takes ${KEYS.join(', ')}.`,
    )
  }
  if (typeof spec.grade !== 'function') {
    throw new DefinitionError(`${where} needs grade, a function from the trial to its grade`)
  }
  return spec
}

const pick = ({ file, directory }: ReturnType<typeof helpersFor>): GraderHelpers => ({
  file,
  directory,
})

export function checkName(name: unknown, where: string): asserts name is string {
  if (typeof name !== 'string' || !NAME.test(name)) {
    throw new DefinitionError(
      `${where} needs a name of at most 80 letters, digits, ".", "_" or "-", starting with a letter or digit (got ${JSON.stringify(name)})`,
    )
  }
}

function extrasOf(
  spec: Record<string, unknown>,
  where: string,
): { revision?: number; timeoutMs: number } {
  if (
    spec.revision !== undefined &&
    !(Number.isInteger(spec.revision) && (spec.revision as number) >= 0)
  ) {
    throw new DefinitionError(
      `revision in ${where} must be a whole number, e.g. revision: 2 (got ${JSON.stringify(spec.revision)})`,
    )
  }
  let timeoutMs: number
  try {
    timeoutMs = parseDuration((spec.timeout ?? DEFAULT_TIMEOUT) as never)
  } catch (error) {
    throw new DefinitionError(`timeout in ${where}: ${(error as Error).message}`)
  }
  return {
    ...(spec.revision !== undefined ? { revision: spec.revision as number } : {}),
    timeoutMs,
  }
}

function runOf(
  spec: Record<string, unknown>,
  names: string[],
  where: string,
  file: string | undefined,
  base: string,
): CodeRun {
  const files = spec.files ?? []
  if (!Array.isArray(files) || files.some((f) => typeof f !== 'string' || !f)) {
    throw new DefinitionError(
      `files in ${where} must be a list of globs of workspace files, e.g. files: ['package.json', 'src/**'] (got ${JSON.stringify(files)})`,
    )
  }
  const extras = extrasOf(spec, where)
  const env = envOf(spec.env, spec.egress, where)
  return {
    kind: 'code',
    grade: spec.grade as CodeRun['grade'],
    names,
    files: files as string[],
    data: dataOf(spec.data, where, base),
    ...extras,
    ...(env ? { env } : {}),
    gradeDigest: functionDigest(spec.grade as () => unknown, file, `grade in ${where}`),
  }
}

function envOf(env: unknown, egress: unknown, where: string): GraderEnv | undefined {
  if (env === undefined) {
    if (egress === undefined) return undefined
    throw new DefinitionError(
      `egress in ${where} is the network of its env sandbox, and it has no env. Give it env: docker(), or leave egress out.`,
    )
  }
  const kind = isObjectLike(env) ? (env as { kind?: unknown }).kind : undefined
  if (typeof kind !== 'string' || !ENV_KINDS.includes(kind)) {
    throw new DefinitionError(
      `env in ${where} must be docker(), podman() or fakeSandbox() from reeval/sandbox (got ${typeof kind === 'string' ? `the ${kind} sandbox` : got(env)})`,
    )
  }
  const policy = egress ?? 'deny-all'
  const problem = policyProblem(policy, where, 'egress')
  if (problem) throw new DefinitionError(problem)
  const sandbox = env as SandboxDescriptor
  const planned = { policy: policy as EgressPolicy, auto: [] }
  const refused = unenforceable(planned, sandbox, where)
  if (refused) throw new DefinitionError(refused)
  return { sandbox, egress: planned }
}

function dataOf(data: unknown, where: string, base: string): CodeRun['data'] {
  if (data === undefined) return {}
  const usage = `data in ${where} must be an object of host files, e.g. data: { baseline: file('baseline.json') }`
  if (!isObjectLike(data) || Array.isArray(data)) throw new DefinitionError(usage)
  const resolved = (value: unknown, field: string): HostFile => {
    if (!isHostFile(value)) throw new DefinitionError(`${usage} (${field} isn't one)`)
    const path = toPath(value.path, base)
    if (!existsSync(path)) {
      throw new DefinitionError(
        `${field} in ${where}: ${path} doesn't exist. Paths are relative to the file that defines the grader.`,
      )
    }
    return { kind: 'file', path }
  }
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      isHostFile(value) || !isObjectLike(value)
        ? resolved(value, `data.${key}`)
        : Object.fromEntries(
            Object.entries(value).map(([path, f]) => [path, resolved(f, `data.${key}["${path}"]`)]),
          ),
    ]),
  )
}

export function weightOf(value: unknown, where: string): number {
  if (value === undefined) return 1
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new DefinitionError(
      `weight in ${where} must be a number of 0 or more (got ${JSON.stringify(value)})`,
    )
  }
  return value
}

export function requiredOf(value: unknown, where: string): boolean {
  if (value === undefined) return false
  if (typeof value !== 'boolean') {
    throw new DefinitionError(
      `required in ${where} must be true or false (got ${JSON.stringify(value)})`,
    )
  }
  return value
}

function grader(def: GraderDef): Grader {
  return Object.freeze({ kind: def.run.kind, name: def.name, [GRADER]: def })
}

/** A judge grader's definition from its checked spec. */
export function judgeGrader(
  name: string,
  s: Record<string, unknown>,
  where: string,
  base: string,
): Grader {
  const run = judgeRunOf(s.judge, [name], where, extrasOf(s, where), base)
  const table =
    judgeScoreOf(s.score, run.answers, where) ?? (run.answers ? undefined : { true: 1, false: 0 })
  const required = requiredOf(s.required, where)
  if (required && !table) {
    throw new DefinitionError(
      `${where} is required but its answers have no score. Give each answer one, e.g. score: { ${run.answers?.map((a) => `${JSON.stringify(a)}: …`).join(', ')} }`,
    )
  }
  return grader({
    name,
    run,
    ...(table ? { score: judgeScore(table) } : {}),
    ...(s.score !== undefined ? { scoreDigest: sha256(canonicalJson(table ?? {})) } : {}),
    weight: weightOf(s.weight, where),
    required,
  })
}

/**
 * A grader: what it reads of a trial once the task returns, and how its grade scores. Pass a
 * spec, or a callback that takes the `file` and `directory` helpers for its `data`.
 *
 *     export const noNewDeps = defineGrader('no-new-deps', {
 *       files: ['package.json'],
 *       grade: async (c) => !JSON.parse(await c.readFile('package.json')).dependencies?.lodash,
 *     })
 */
// biome-ignore lint/suspicious/noExplicitAny: a grader typed by its case alone takes any grade, as G can't be inferred once C is given
export function defineGrader<C = unknown, G extends JSONValue = any>(
  name: string,
  spec: Input<GraderSpec<C, G> | JudgeGraderSpec<C>>,
): Grader<C> {
  const where = `defineGrader("${name}")`
  checkName(name, 'defineGrader')
  const file = callerFile()
  const base = file ? dirname(file) : process.cwd()
  const s = specOf(spec, where, base, true)
  if ('judge' in s) return judgeGrader(name, s, where, base)
  if (s.score !== undefined && typeof s.score !== 'function') {
    throw new DefinitionError(`score in ${where} must be a function from the grade to [0, 1]`)
  }
  return grader({
    name,
    run: runOf(s, [name], where, file, file ? dirname(file) : process.cwd()),
    ...(s.score
      ? {
          score: s.score as GraderDef['score'],
          scoreDigest: functionDigest(s.score as () => unknown, file, `score in ${where}`),
        }
      : {}),
    weight: weightOf(s.weight, where),
    required: requiredOf(s.required, where),
  })
}

/**
 * Graders that share one `grade` call per trial, each scoring its grade its own way:
 *
 *     export const [builds, tests] = defineGraders(['builds', 'tests'], {
 *       grade: (c) => ({ built: …, passed: … }),
 *       score: { builds: (g) => (g.built ? 1 : 0), tests: (g) => g.passed / 10 },
 *     })
 *
 * To declare the case type the graders read, call it with the type first:
 * `defineGraders<{ input: string }>()(['builds', 'tests'], { … })`.
 */
export function defineGraders<C>(): GraderGroupDefiner<C>
export function defineGraders<
  const Names extends readonly string[],
  C = unknown,
  G extends JSONValue = JSONValue,
>(names: Names, spec: Input<GraderGroupSpec<Names[number], C, G>>): Graders<Names, C>
export function defineGraders(names?: unknown, spec?: unknown): unknown {
  if (names === undefined && spec === undefined) {
    return (n: readonly string[], s: Input<GraderGroupSpec<string>>) => graderGroup(n, s)
  }
  return graderGroup(names as readonly string[], spec as Input<GraderGroupSpec<string>>)
}

/** One grader per name, each typed by the cases it reads. */
export type Graders<Names extends readonly string[], C> = { [K in keyof Names]: Grader<C> }

/** `defineGraders<C>()`: `defineGraders` with the case type given and the names inferred. */
export type GraderGroupDefiner<C> = <
  const Names extends readonly string[],
  G extends JSONValue = JSONValue,
>(
  names: Names,
  spec: Input<GraderGroupSpec<Names[number], C, G>>,
) => Graders<Names, C>

function graderGroup(names: readonly string[], spec: Input<GraderGroupSpec<string>>): Grader[] {
  const where = `defineGraders(${JSON.stringify(names)})`
  if (!Array.isArray(names) || !names.length) {
    throw new DefinitionError(
      `defineGraders needs a list of grader names, e.g. ['builds', 'tests']`,
    )
  }
  for (const name of names) checkName(name, 'defineGraders')
  const twice = names.find((n, i) => names.indexOf(n) !== i)
  if (twice) throw new DefinitionError(`${where} names ${twice} twice`)
  const file = callerFile()
  const base = file ? dirname(file) : process.cwd()
  const s = specOf(spec, where, base)
  const score = s.score
  if (
    !isObjectLike(score) ||
    names.some((n) => typeof (score as Record<string, unknown>)[n] !== 'function') ||
    Object.keys(score).some((k) => !names.includes(k))
  ) {
    throw new DefinitionError(
      `score in ${where} must give each grader its score function, e.g. score: { ${names.map((n) => `${JSON.stringify(n)}: (grade) => …`).join(', ')} }`,
    )
  }
  const perName = (value: unknown, field: string, name: string): unknown => {
    if (!isObjectLike(value) || Array.isArray(value)) return value
    const extra = Object.keys(value).filter((k) => !names.includes(k))
    if (extra.length)
      throw new DefinitionError(`${field} in ${where} names no grader ${extra.join(', ')}`)
    return value[name]
  }
  const run = runOf(s, [...names], where, file, base)
  return names.map((name) => {
    const fn = (score as Record<string, GraderDef['score']>)[name] as NonNullable<
      GraderDef['score']
    >
    return grader({
      name,
      run,
      score: fn,
      scoreDigest: functionDigest(fn, file, `score in ${where}'s ${name}`),
      weight: weightOf(perName(s.weight, 'weight', name), `${where}'s ${name}`),
      required: requiredOf(perName(s.required, 'required', name), `${where}'s ${name}`),
    })
  })
}

/** An eval's `graders`, each a grader once (a `defineGraders` group's members in place). */
export function graderList(value: unknown, where: string): GraderDef[] {
  const usage = `graders in ${where} must be a list of defineGrader results, e.g. graders: [noNewDeps]`
  if (!Array.isArray(value)) throw new UsageError(`${usage} (got ${typeof value})`)
  const defs = value.flat().map((g, i) => {
    const def = graderDef(g)
    if (!def) throw new UsageError(`${usage} (item ${i + 1} isn't one)`)
    return def
  })
  const names = defs.map((d) => d.name)
  const twice = names.find((n, i) => names.indexOf(n) !== i)
  if (twice) {
    throw new UsageError(
      `graders in ${where} has two graders named ${twice}. Give each grader of an eval its own name.`,
    )
  }
  return defs
}
