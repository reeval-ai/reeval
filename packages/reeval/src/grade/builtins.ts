// reeval's built-in graders, `reeval/graders`: graders over what an attempt already records,
// each grading with one of `reeval/graders/match`'s functions. A built-in's options are data, so
// the config and another language declare one as `BuiltinGraderData`, and its fingerprint is its
// kind, its arguments and its kind's version, which goes up when what the kind grades changes.
import { limitsProblem, overLimits, runMatchLabel } from '../assert.ts'
import { callerFile, DefinitionError } from '../environment.ts'
import { UsageError } from '../errors.ts'
import { isObjectLike } from '../object.ts'
import { redactSecrets } from '../redact.ts'
import type { BuiltinGraderData, BuiltinKind, Duration, JSONValue } from '../types.ts'
import { GradeError } from './context.ts'
import { checkName, GRADER, type GraderDef, requiredOf, weightOf } from './define.ts'
import { functionDigest } from './digest.ts'
import * as match from './match.ts'
import type { Grader, GraderContext } from './types.ts'

/** A built-in's options: all data but `score`. */
export type BuiltinOptions<G> = {
  /** In place of `<kind>:<main argument>`, to tell two of one kind apart in one eval. */
  name?: string
  /** Its share of the attempt's score. Default 1; 0 records only. */
  weight?: number
  /** A failed natural pass (or an error) makes the attempt's score 0. Default false. */
  required?: boolean
  /** The grade's score in [0, 1], in place of 1 or 0 for its natural pass. */
  score?: (grade: G) => number
}

/** What a built-in's definition keeps for its record, the plan and its data form. */
export type BuiltinDef = {
  kind: BuiltinKind
  version: number
  /** Its arguments as data, a regular expression as `{ regexp, flags? }`. */
  args: JSONValue[]
  /** Its data form; unset when a function (`score`, a predicate) is part of it. */
  data?: BuiltinGraderData
}

const OPTION_KEYS = ['name', 'weight', 'required', 'score']
const TIMEOUT_MS = 5 * 60_000
const LIMIT_KEYS = ['tokens', 'toolCalls', 'duration', 'cost']
const LIMITS_EXAMPLE =
  'e.g. withinLimits({ tokens: 200_000, toolCalls: { bash: 10 }, duration: "10m", cost: 0.5 })'

/** The factory each kind is, by its kind in grader names. */
const FACTORIES: Record<BuiltinKind, string> = {
  'used-skill': 'usedSkill',
  'called-tool': 'calledTool',
  'called-mcp': 'calledMcp',
  ran: 'ran',
  searched: 'searched',
  fetched: 'fetched',
  wrote: 'wrote',
  'in-diff': 'inDiff',
  'not-in-diff': 'notInDiff',
  'has-file': 'hasFile',
  succeeded: 'succeeded',
  'within-limits': 'withinLimits',
  turns: 'turns',
  tokens: 'tokens',
  cost: 'cost',
  duration: 'duration',
  'page-status': 'pageStatus',
  'no-page-errors': 'noPageErrors',
  observed: 'observed',
}

/**
 * Whether a page's status is `status`, a code from 100 to 599 or a range from `'1xx'` to `'5xx'`;
 * undefined for anything else. No response (an undefined status) is never one.
 */
function statusTest(status: unknown): ((actual: number | undefined) => boolean) | undefined {
  const range = typeof status === 'string' && /^[1-5]xx$/.test(status) ? Number(status[0]) : 0
  const code =
    typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599
  if (!range && !code) return undefined
  return (actual) =>
    actual !== undefined && (range ? Math.floor(actual / 100) === range : actual === status)
}

type C = GraderContext
type Args = readonly unknown[]

type Kind = {
  version: number
  /** The arguments' text in its name, after the kind; undefined for none. */
  main: (args: Args) => string | undefined
  /** Why the arguments aren't ones the factory takes, else undefined. */
  problem: (args: Args) => string | undefined
  /** The same as a whole sentence about `who`, for a kind whose sentences are shared. */
  refuse?: (args: Args, who: string) => string | undefined
  grade: (c: C, args: Args) => unknown
  /** Its natural pass; unset for a kind that only records. */
  pass?: (grade: never, args: Args) => boolean
  /** The kept workspace files it reads. */
  files?: (args: Args) => string[]
}

const isPattern = (v: unknown) => typeof v === 'string' || v instanceof RegExp
const optionalPattern = (what: string, v: unknown) =>
  v === undefined || isPattern(v) ? undefined : `${what} is a string or a regular expression`
/** A list's item in a name, quoted when it holds a comma or a quote, so no two lists share one. */
const listItem = (v: unknown) => {
  const t = String(v)
  return /[,"]/.test(t) ? JSON.stringify(t) : t
}
const text = (v: unknown): string | undefined =>
  v === undefined
    ? undefined
    : Array.isArray(v)
      ? v.map(listItem).join(',')
      : (runMatchLabel(v) ?? String(v))
const nonEmpty = (g: unknown[]) => g.length > 0
const atLeastOne = (g: number) => g >= 1
const isPathMatch = (v: unknown) =>
  isPattern(v) || (Array.isArray(v) && v.length > 0 && v.every(isPattern))

type Limits = {
  tokens?: number
  toolCalls?: number | Record<string, number>
  duration?: Duration
  cost?: number
}
type Measured = {
  tokens?: number
  toolCalls?: number | Record<string, number>
  duration?: number
  cost?: number
}

function measure(c: C, limits: Limits): Measured {
  const used = match.usage(c)
  const out: Measured = {}
  if (limits.tokens !== undefined) {
    if (used.tokens === null) {
      throw new GradeError("a turn's harness reported no token usage, so tokens can't be checked")
    }
    out.tokens = used.tokens
  }
  if (typeof limits.toolCalls === 'number') out.toolCalls = used.toolCalls
  else if (limits.toolCalls) {
    out.toolCalls = Object.fromEntries(
      Object.keys(limits.toolCalls).map((tool) => [tool, match.toolCallsOf(c, tool)]),
    )
  }
  if (limits.duration !== undefined) out.duration = used.durationMs
  if (limits.cost !== undefined) {
    if (used.cost === null) {
      throw new GradeError(
        "a turn that used tokens has no cost, reported or at list prices, so cost can't be checked",
      )
    }
    out.cost = used.cost
  }
  return out
}

/** Whether what was measured stayed within each limit, as `toStayWithin` checks it. */
const within = (m: Measured, limits: Limits): boolean =>
  overLimits(
    {
      tokens: m.tokens ?? 0,
      toolCalls: typeof m.toolCalls === 'number' ? m.toolCalls : 0,
      callsOf: (tool) => (typeof m.toolCalls === 'object' ? (m.toolCalls[tool] ?? 0) : 0),
      durationMs: m.duration ?? 0,
      cost: m.cost ?? 0,
    },
    limits,
  ).length === 0

const recorded = (version: number, grade: (c: C) => unknown): Kind => ({
  version,
  main: () => undefined,
  problem: (args) => (args.length ? 'takes no arguments but its options' : undefined),
  grade,
})

const KINDS: Record<BuiltinKind, Kind> = {
  'used-skill': {
    version: 1,
    main: ([name]) => text(name),
    problem: ([name]) =>
      name === undefined || (typeof name === 'string' && name) ? undefined : 'name is a string',
    grade: (c, [name]) =>
      name === undefined ? match.usedSkills(c) : match.calledSkill(c, name as string),
    pass: (g: boolean | string[]) => (Array.isArray(g) ? g.length > 0 : g),
  },
  'called-tool': {
    version: 1,
    main: ([name]) => text(name),
    problem: ([name, input]) =>
      !isPattern(name)
        ? "takes the tool's name, a string or a regular expression"
        : input !== undefined && !isPattern(input) && !isObjectLike(input)
          ? 'input is a string, a regular expression or an object of fields'
          : undefined,
    grade: (c, [name, input]) => match.calledTool(c, name as string, input as never),
    pass: atLeastOne,
  },
  'called-mcp': {
    version: 1,
    main: ([server, tool]) => (tool === undefined ? text(server) : `${server}/${tool}`),
    problem: ([server, tool]) =>
      typeof server !== 'string' || !server
        ? "takes the MCP server's name"
        : tool !== undefined && (typeof tool !== 'string' || !tool)
          ? "the tool is the server's tool name"
          : undefined,
    grade: (c, [server, tool]) => match.calledMcp(c, server as string, tool as string | undefined),
    pass: atLeastOne,
  },
  ran: {
    version: 1,
    main: ([command]) => text(command),
    problem: ([command]) =>
      command === undefined || isPattern(command) || runMatchLabel(command) !== undefined
        ? undefined
        : 'command is a string, a regular expression or { program, args? }',
    grade: (c, [command]) => match.ran(c, command as never),
    pass: atLeastOne,
  },
  searched: {
    version: 1,
    main: ([query]) => text(query),
    problem: ([query]) => optionalPattern('query', query),
    grade: (c, [query]) => match.searched(c, query as never),
    pass: atLeastOne,
  },
  fetched: {
    version: 1,
    main: ([url]) => text(url),
    problem: ([url]) => optionalPattern('url', url),
    grade: (c, [url]) => match.fetched(c, url as never),
    pass: atLeastOne,
  },
  wrote: {
    version: 1,
    main: ([path]) => text(path),
    problem: ([path]) => optionalPattern('path', path),
    grade: (c, [path]) => match.wrote(c, path as never),
    pass: nonEmpty,
  },
  'in-diff': {
    version: 1,
    main: ([paths]) => text(paths),
    problem: ([paths]) =>
      isPathMatch(paths) ? undefined : 'takes paths: a glob, a regular expression or a list',
    grade: (c, [paths]) => match.inDiff(c, paths as never),
    pass: nonEmpty,
  },
  'not-in-diff': {
    version: 1,
    main: ([paths]) => text(paths),
    problem: ([paths]) =>
      isPathMatch(paths) ? undefined : 'takes paths: a glob, a regular expression or a list',
    grade: (c, [paths]) => match.inDiff(c, paths as never),
    pass: (g: string[]) => g.length === 0,
  },
  'has-file': {
    version: 1,
    main: ([path]) => text(path),
    problem: ([path, content]) =>
      typeof path !== 'string' || !path
        ? "takes the file's workspace path"
        : optionalPattern('content', content),
    grade: (c, [path, content]) => match.hasFile(c, path as string, content as never),
    pass: (g: boolean) => g,
    files: ([path]) => [path as string],
  },
  succeeded: {
    version: 1,
    main: ([command]) => text(command),
    problem: ([command]) =>
      typeof command === 'string' && command ? undefined : "takes a c.exec's command or label",
    grade: (c, [command]) => match.succeeded(c, command as string),
    pass: (g: number) => g === 0,
  },
  'within-limits': {
    version: 1,
    main: () => undefined,
    problem: () => undefined,
    refuse: ([limits], who) => limitsProblem(limits, who, LIMIT_KEYS, LIMITS_EXAMPLE),
    grade: (c, [limits]) => measure(c, limits as Limits),
    pass: (g: Measured, [limits]) => within(g, limits as Limits),
  },
  turns: recorded(1, (c) => match.usage(c).turns),
  tokens: recorded(1, (c) => match.usage(c).tokens),
  cost: recorded(1, (c) => match.usage(c).cost),
  duration: recorded(1, (c) => match.usage(c).durationMs),
  'page-status': {
    version: 1,
    main: ([capture]) => text(capture),
    problem: ([capture, status]) =>
      typeof capture !== 'string' || !capture
        ? "takes the capture's name"
        : !statusTest(status)
          ? "the status is a code from 100 to 599, or a range from '1xx' to '5xx'"
          : undefined,
    grade: (c, [capture]) => match.pageStatus(c, capture as string),
    pass: (g: number | null, [, status]) =>
      (statusTest(status) as (n: number | undefined) => boolean)(g ?? undefined),
  },
  'no-page-errors': {
    version: 1,
    main: ([capture]) => text(capture),
    problem: ([capture]) =>
      typeof capture === 'string' && capture ? undefined : "takes the capture's name",
    grade: (c, [capture]) => match.pageErrors(c, capture as string),
    pass: (g: number) => g === 0,
  },
  observed: {
    version: 1,
    main: ([name]) => text(name),
    problem: ([name]) =>
      typeof name === 'string' && name ? undefined : "takes the observation's name",
    grade: (c, [name]) => c.observation(name as string),
  },
}

/** An argument as data: each regular expression in it as `{ regexp, flags? }`. */
function toData(value: unknown): JSONValue {
  if (value instanceof RegExp) {
    return { regexp: value.source, ...(value.flags ? { flags: value.flags } : {}) }
  }
  if (Array.isArray(value)) return value.map(toData)
  if (isObjectLike(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toData(v)]))
  }
  return value as JSONValue
}

/** An argument from data: each `{ regexp, flags? }` in it a `RegExp`. */
function fromData(value: unknown, where: string): unknown {
  if (Array.isArray(value)) return value.map((v) => fromData(v, where))
  if (!isObjectLike(value)) return value
  const keys = Object.keys(value)
  if (
    typeof value.regexp === 'string' &&
    keys.every((k) => k === 'regexp' || k === 'flags') &&
    (value.flags === undefined || typeof value.flags === 'string')
  ) {
    try {
      return new RegExp(value.regexp, value.flags as string | undefined)
    } catch (error) {
      throw new UsageError(`${where}: ${(error as Error).message}`)
    }
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromData(v, where)]))
}

const MAX_NAME = 200

/** A built-in's grader: `kind` on `args`, with `options` checked. */
function make(
  kind: BuiltinKind,
  args: Args,
  options: unknown,
  predicate?: (grade: never) => boolean,
): Grader {
  const factory = FACTORIES[kind]
  const spec = KINDS[kind]
  const problem = spec.problem(args)
  if (problem) throw new DefinitionError(`${factory}() ${problem} (got ${showArgs(args)})`)
  const refusal = spec.refuse?.(args, `${factory}()`)
  if (refusal) throw new DefinitionError(refusal)
  if (options !== undefined && (!isObjectLike(options) || Array.isArray(options))) {
    throw new DefinitionError(
      `${factory}()'s options are an object, e.g. { weight: 2, required: true }`,
    )
  }
  const o = (options ?? {}) as Record<string, unknown>
  const unknown = Object.keys(o).filter((k) => !OPTION_KEYS.includes(k))
  if (unknown.length) {
    throw new DefinitionError(
      `${factory}() doesn't take ${unknown.join(', ')}. A built-in grader takes ${OPTION_KEYS.join(', ')}.`,
    )
  }
  const where = `${factory}()`
  if (o.name !== undefined) checkName(o.name, where)
  if (o.score !== undefined && typeof o.score !== 'function') {
    throw new DefinitionError(`score in ${where} must be a function from the grade to [0, 1]`)
  }
  const main = spec.main(args)
  const name =
    (o.name as string | undefined) ??
    redactSecrets(main === undefined ? kind : `${kind}:${main}`).slice(0, MAX_NAME)
  const weight = weightOf(o.weight, where)
  const required = requiredOf(o.required, where)
  const pass = predicate ?? spec.pass
  const userScore = o.score as GraderDef['score']
  if (required && !pass && !userScore && kind !== 'observed') {
    throw new DefinitionError(
      `${where} records its grade with no pass, so it can't be required alone. Give it score.`,
    )
  }
  const file = callerFile()
  const scoreFn: GraderDef['score'] =
    userScore ??
    (pass
      ? (((g: never) => ((pass as (g: never, a: Args) => boolean)(g, args) ? 1 : 0)) as never)
      : undefined)
  const scoreSource = userScore ?? predicate
  const wired = args.map(toData)
  const data: BuiltinGraderData | undefined = scoreSource
    ? undefined
    : {
        builtin: kind,
        ...(wired.length ? { args: wired } : {}),
        ...(o.name !== undefined ? { name: o.name as string } : {}),
        ...(o.weight !== undefined ? { weight } : {}),
        ...(o.required !== undefined ? { required } : {}),
      }
  const def: GraderDef = {
    name,
    run: {
      kind: 'code',
      grade: (c) => spec.grade(c, args),
      names: [name],
      files: spec.files?.(args) ?? [],
      data: {},
      timeoutMs: TIMEOUT_MS,
      gradeDigest: '',
    },
    ...(scoreFn ? { score: scoreFn } : {}),
    ...(scoreSource
      ? {
          scoreDigest: functionDigest(
            scoreSource as () => unknown,
            file,
            userScore ? `score in ${where}` : `${where}'s predicate`,
          ),
        }
      : {}),
    weight,
    required,
    builtin: { kind, version: spec.version, args: wired, ...(data ? { data } : {}) },
  }
  return Object.freeze({ kind: 'builtin' as const, name, [GRADER]: def })
}

const showArgs = (args: Args) =>
  args.length
    ? args.map((a) => (a instanceof RegExp ? String(a) : JSON.stringify(a))).join(', ')
    : 'nothing'

/** Whether `value` is a built-in's options rather than an argument: an object of option keys only. */
const isOptions = (value: unknown): boolean =>
  isObjectLike(value) &&
  !Array.isArray(value) &&
  !(value instanceof RegExp) &&
  Object.keys(value).every((k) => OPTION_KEYS.includes(k))

/** Splits `(arg?, options?)` where the argument is never a plain object. */
function optionalArg(a: unknown, b: unknown): [Args, unknown] {
  return isOptions(a) && b === undefined ? [[], a] : [a === undefined ? [] : [a], b]
}

/**
 * Whether the agent used the skill `name` (`used-skill:<name>`), or with no name, which of the
 * skills the environment placed it used (`used-skill`). Passes when it did, or used any.
 */
export function usedSkill(options?: BuiltinOptions<string[]>): Grader
export function usedSkill(name: string, options?: BuiltinOptions<boolean>): Grader
export function usedSkill(a?: unknown, b?: unknown): Grader {
  const [args, options] = optionalArg(a, b)
  return make('used-skill', args, options)
}

/**
 * How many tool calls were named `name`, with an input matching `input` when given
 * (`called-tool:<name>`). Passes at 1 or more. An `input` of option keys alone reads as the
 * options: pass the options too to match one.
 */
export function calledTool(
  name: string | RegExp,
  input?: match.ToolInputMatch,
  options?: BuiltinOptions<number>,
): Grader
export function calledTool(name: string | RegExp, options?: BuiltinOptions<number>): Grader
export function calledTool(name: unknown, b?: unknown, c?: unknown): Grader {
  if (c === undefined && isOptions(b)) return make('called-tool', [name], b)
  return make('called-tool', b === undefined ? [name] : [name, b], c)
}

/** How many calls went to the MCP server `server`, or its `tool` (`called-mcp:<server>/<tool>`). Passes at 1 or more. */
export function calledMcp(server: string, options?: BuiltinOptions<number>): Grader
export function calledMcp(server: string, tool: string, options?: BuiltinOptions<number>): Grader
export function calledMcp(server: unknown, b?: unknown, c?: unknown): Grader {
  if (typeof b === 'string') return make('called-mcp', [server, b], c)
  return make('called-mcp', [server], b)
}

/** How many shell commands matched `command` (`ran:<command>`). Passes at 1 or more. */
export function ran(
  command?: string | RegExp | match.RunMatch,
  options?: BuiltinOptions<number>,
): Grader
export function ran(options?: BuiltinOptions<number>): Grader
export function ran(a?: unknown, b?: unknown): Grader {
  const [args, options] = optionalArg(a, b)
  return make('ran', args, options)
}

/** How many web searches matched `query` (`searched:<query>`). Passes at 1 or more. */
export function searched(query?: string | RegExp, options?: BuiltinOptions<number>): Grader
export function searched(options?: BuiltinOptions<number>): Grader
export function searched(a?: unknown, b?: unknown): Grader {
  const [args, options] = optionalArg(a, b)
  return make('searched', args, options)
}

/** How many web fetches matched `url` (`fetched:<url>`). Passes at 1 or more. */
export function fetched(url?: string | RegExp, options?: BuiltinOptions<number>): Grader
export function fetched(options?: BuiltinOptions<number>): Grader
export function fetched(a?: unknown, b?: unknown): Grader {
  const [args, options] = optionalArg(a, b)
  return make('fetched', args, options)
}

/**
 * The paths the agent's write and edit tool calls touched, matching `path` (`wrote:<path>`).
 * Passes when there are any.
 */
export function wrote(path?: string | RegExp, options?: BuiltinOptions<string[]>): Grader
export function wrote(options?: BuiltinOptions<string[]>): Grader
export function wrote(a?: unknown, b?: unknown): Grader {
  const [args, options] = optionalArg(a, b)
  return make('wrote', args, options)
}

/** The final diff's paths under `paths` (`in-diff:<paths>`). Passes when there are any. */
export function inDiff(paths: match.PathMatch, options?: BuiltinOptions<string[]>): Grader {
  return make('in-diff', [paths], options)
}

/** The final diff's paths under `paths` (`not-in-diff:<paths>`). Passes when there are none. */
export function notInDiff(paths: match.PathMatch, options?: BuiltinOptions<string[]>): Grader {
  return make('not-in-diff', [paths], options)
}

/**
 * Whether the final workspace has `path`, with `content` in it when given (`has-file:<path>`).
 * The attempt keeps the file for it.
 */
export function hasFile(
  path: string,
  content?: string | RegExp,
  options?: BuiltinOptions<boolean>,
): Grader
export function hasFile(path: string, options?: BuiltinOptions<boolean>): Grader
export function hasFile(path: unknown, b?: unknown, c?: unknown): Grader {
  if (c === undefined && isOptions(b)) return make('has-file', [path], b)
  return make('has-file', b === undefined ? [path] : [path, b], c)
}

/**
 * The exit code of the last `c.exec` labeled `commandOrLabel`, else the last that ran it
 * (`succeeded:<commandOrLabel>`). Passes at 0.
 */
export function succeeded(commandOrLabel: string, options?: BuiltinOptions<number>): Grader {
  return make('succeeded', [commandOrLabel], options)
}

/**
 * What the turns used of each limit (`within-limits`): tokens, tool calls (in all or per tool),
 * the agent's time in milliseconds and the turns' cost in US dollars, reported or at list prices. Passes when each is
 * within its limit.
 */
export function withinLimits(
  limits: {
    tokens?: number
    toolCalls?: number | Readonly<Record<string, number>>
    duration?: Duration
    cost?: number
  },
  options?: BuiltinOptions<Measured>,
): Grader {
  return make('within-limits', [limits], options)
}

/** How many turns the attempt took (`turns`). Records it; scores with `score`. */
export const turns = (options?: BuiltinOptions<number>): Grader => make('turns', [], options)

/** The turns' tokens, or null when a harness reported none (`tokens`). Records it; scores with `score`. */
export const tokens = (options?: BuiltinOptions<number | null>): Grader =>
  make('tokens', [], options)

/**
 * The turns' cost in US dollars, reported or estimated at list prices, or null when a turn that
 * used tokens has neither (`cost`). Records it; scores with `score`.
 */
export const cost = (options?: BuiltinOptions<number | null>): Grader => make('cost', [], options)

/** The agent's time over its turns, in milliseconds (`duration`). Records it; scores with `score`. */
export const duration = (options?: BuiltinOptions<number>): Grader => make('duration', [], options)

/**
 * A capture's page status, or null with no response (`page-status:<capture>`). Passes when it's
 * `status`: a code, or a range such as `'2xx'`.
 */
export function pageStatus(
  capture: string,
  status: number | `${1 | 2 | 3 | 4 | 5}xx`,
  options?: BuiltinOptions<number | null>,
): Grader {
  return make('page-status', [capture, status], options)
}

/** How many uncaught errors a capture's page had (`no-page-errors:<capture>`). Passes at 0. */
export function noPageErrors(capture: string, options?: BuiltinOptions<number>): Grader {
  return make('no-page-errors', [capture], options)
}

/**
 * The last `c.observe(name, …)` value (`observed:<name>`). Passes when `predicate` says so;
 * without one, a boolean value scores 1 or 0 and any other is recorded.
 */
export function observed<G extends JSONValue = JSONValue>(
  name: string,
  predicate?: (value: G) => boolean,
  options?: BuiltinOptions<G>,
): Grader
export function observed<G extends JSONValue = JSONValue>(
  name: string,
  options?: BuiltinOptions<G>,
): Grader
export function observed(name: unknown, b?: unknown, c?: unknown): Grader {
  if (typeof b === 'function') {
    return make('observed', [name], c, b as (g: never) => boolean)
  }
  if (b !== undefined && c !== undefined) {
    throw new DefinitionError(
      `observed()'s predicate is a function from the value to true or false`,
    )
  }
  return make('observed', [name], b)
}

/** A built-in from its data form, as the config or another language declares one. */
export function builtinFromData(data: BuiltinGraderData, where: string): Grader {
  if (
    !isObjectLike(data) ||
    typeof data.builtin !== 'string' ||
    !Object.hasOwn(KINDS, data.builtin)
  ) {
    throw new UsageError(
      `${where} takes reeval/graders' built-ins, or one as data such as { builtin: 'used-skill', args: ['http-retries'] } (got ${JSON.stringify(data)})`,
    )
  }
  const { builtin, args = [], ...options } = data
  const unknown = Object.keys(options).filter((k) => !['name', 'weight', 'required'].includes(k))
  if (unknown.length) {
    throw new UsageError(
      `${where}: ${builtin} as data takes args, name, weight and required, not ${unknown.join(', ')}`,
    )
  }
  if (!Array.isArray(args)) {
    throw new UsageError(`${where}: ${builtin}'s args are a list`)
  }
  try {
    return make(builtin, fromData(args, `${where}`) as Args, options)
  } catch (error) {
    if (error instanceof DefinitionError) throw new UsageError(`${where}: ${error.message}`)
    throw error
  }
}
