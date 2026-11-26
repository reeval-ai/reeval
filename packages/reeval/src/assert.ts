import picomatch from 'picomatch'
import { closest } from './contract/shared.ts'
import { parseDuration } from './duration.ts'
import { skillsUsed } from './history/tool-class.ts'
import { targetText } from './history/tool-target.ts'
import { isObjectLike } from './object.ts'
import { commandOf, isShellCall, trajectoryCommands } from './shell-commands.ts'
import { formatDuration } from './text.ts'
import type {
  Duration,
  FileChange,
  TokenUsage,
  TrajectoryEvent,
  Turn,
  WebEventType,
} from './types.ts'
import { totalTokens } from './usage.ts'

/** A check the turn's harness can't answer either way, e.g. a web fetch it never reports. */
export class HarnessCapabilityError extends Error {
  override name = 'HarnessCapabilityError'
}

export type ToolInputMatch = string | RegExp | Record<string, unknown>

type ToolEvent = Extract<TrajectoryEvent, { type: 'tool' }>

export type Subject = Pick<Turn, 'trajectory' | 'unreported'>

const matches = (value: string, pattern: RegExp | string | undefined) =>
  pattern === undefined ||
  (typeof pattern === 'string' ? value.includes(pattern) : pattern.test(value))

const toolsOf = (trajectory: TrajectoryEvent[]) =>
  trajectory.flatMap((e) => (e.type === 'tool' ? [e] : []))

const editsOf = (trajectory: TrajectoryEvent[]) =>
  trajectory.flatMap((e) => (e.type === 'file-edit' ? [e] : []))

const isSkillCall = (event: ToolEvent, name: string): boolean =>
  skillsUsed(event.tool, targetText(event.input, event.tool), [name]).length > 0

const nameMatches = (tool: string, name: string | RegExp) =>
  typeof name === 'string' ? tool === name : name.test(tool)

export function inputMatches(input: unknown, expected?: ToolInputMatch): boolean {
  if (expected === undefined) return true
  const text = typeof input === 'string' ? input : JSON.stringify(input ?? '')
  if (typeof expected === 'string') return text.includes(expected)
  if (expected instanceof RegExp) return expected.test(text)
  if (!isObjectLike(input)) return false
  return Object.entries(expected).every(([key, value]) => {
    const actual = input[key]
    if (value instanceof RegExp) return value.test(String(actual ?? ''))
    if (typeof value === 'string') {
      return actual === value || String(actual ?? '').includes(value)
    }
    return JSON.stringify(actual) === JSON.stringify(value)
  })
}

const WEB_FIELD: Record<WebEventType, (e: TrajectoryEvent) => string> = {
  'web-search': (e) => ('query' in e ? e.query : ''),
  'web-fetch': (e) => ('url' in e ? e.url : ''),
}

/**
 * The queries (`web-search`) or URLs (`web-fetch`) the trajectory has, all of them and those
 * matching `pattern`. A subject whose harness doesn't report them is a `HarnessCapabilityError`.
 */
export function webEvents(
  subject: Subject,
  type: WebEventType,
  pattern: RegExp | string | undefined,
  matcher: string,
): { seen: string[]; hits: string[] } {
  if (subject.unreported.includes(type)) {
    const what = type === 'web-search' ? 'web searches' : 'web fetches'
    throw new HarnessCapabilityError(
      `${matcher} can't check this turn: its harness doesn't report ${what} ('${type}' is in turn.unreported), so the agent may have made them with no event. Check the reply or files instead, or use a harness that reports them.`,
    )
  }
  const seen = subject.trajectory.filter((e) => e.type === type).map(WEB_FIELD[type])
  return { seen, hits: seen.filter((v) => matches(v, pattern)) }
}

/** The trajectory's tool calls that used the skill `name`. */
export const skillCalls = (trajectory: TrajectoryEvent[], name: string): ToolEvent[] =>
  toolsOf(trajectory).filter((e) => isSkillCall(e, name))

/** Which of the `placed` skills the trajectory's tool calls used, in order of first use. */
export const placedSkillsUsed = (
  trajectory: TrajectoryEvent[],
  placed: readonly string[],
): string[] => [
  ...new Set(
    toolsOf(trajectory).flatMap((e) => skillsUsed(e.tool, targetText(e.input, e.tool), placed)),
  ),
]

/** The trajectory's tool calls named `name`, whose input matches `input` when given. */
export const toolCalls = (
  trajectory: TrajectoryEvent[],
  name: string | RegExp,
  input?: ToolInputMatch,
): ToolEvent[] =>
  toolsOf(trajectory).filter((e) => nameMatches(e.tool, name) && inputMatches(e.input, input))

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The trajectory's calls to the MCP server `server`'s tools, or to its `tool`. */
export const mcpCalls = (
  trajectory: TrajectoryEvent[],
  server: string,
  tool?: string,
  input?: ToolInputMatch,
): ToolEvent[] =>
  toolCalls(
    trajectory,
    tool === undefined ? new RegExp(`^mcp__${escapeRegExp(server)}__.`) : `mcp__${server}__${tool}`,
    input,
  )

/** `ran()`'s object form: the program a segment of a shell command ran, after its wrappers. */
export type RunMatch = {
  /** The program's name without its directory, or a regular expression it matches. */
  program: string | RegExp
  /** Text the program's arguments, joined by spaces, contain, or a regular expression they match. */
  args?: string | RegExp
}

const RUN_MATCH_KEYS = ['program', 'args'] as const

const isPatternArg = (value: unknown): value is string | RegExp =>
  typeof value === 'string' || value instanceof RegExp

function checkRunMatch(match: Record<string, unknown>): RunMatch {
  const example = "e.g. ran({ program: 'genkit', args: /^flow:run\\b/ })"
  for (const key of Object.keys(match)) {
    if ((RUN_MATCH_KEYS as readonly string[]).includes(key)) continue
    const near = closest(key, RUN_MATCH_KEYS)
    throw new TypeError(
      `ran() has no "${key}"; it takes program and args.${near ? ` Did you mean "${near}"?` : ''}`,
    )
  }
  if (!isPatternArg(match.program) || match.program === '') {
    throw new TypeError(
      `ran()'s program is a program name or a regular expression, ${example} (got ${JSON.stringify(match.program)})`,
    )
  }
  if (match.args !== undefined && !isPatternArg(match.args)) {
    throw new TypeError(
      `ran()'s args is text or a regular expression, ${example} (got ${JSON.stringify(match.args)})`,
    )
  }
  return match as RunMatch
}

/**
 * `ran({ program, args })`'s label, `program genkit args /^flow:run\b/`: unlike `ran('genkit')`'s,
 * so switching a grader to the object form starts a new history key.
 */
export function runMatchLabel(match: unknown): string | undefined {
  if (!isObjectLike(match) || match instanceof RegExp || !isPatternArg(match.program)) {
    return undefined
  }
  const { program, args } = match
  const programPart = `program ${String(program)}`
  return isPatternArg(args) ? `${programPart} args ${String(args)}` : programPart
}

const shownCommand = (c: { program: string; args: string[] }) => [c.program, ...c.args].join(' ')

/**
 * The commands the trajectory ran, all of them and those matching `command`: shell commands by
 * their text, or with a `RunMatch`, each program a segment of one ran, after its wrappers.
 */
export function commandsRun(
  trajectory: TrajectoryEvent[],
  command?: RegExp | string | RunMatch,
): { seen: string[]; hits: string[] } {
  if (isObjectLike(command) && !(command instanceof RegExp)) {
    const match = checkRunMatch(command)
    const commands = trajectoryCommands(trajectory)
    const hits = commands.filter(
      (c) =>
        (typeof match.program === 'string'
          ? c.program === match.program
          : match.program.test(c.program)) && matches(c.args.join(' '), match.args),
    )
    return { seen: commands.map(shownCommand), hits: hits.map(shownCommand) }
  }
  const seen = trajectory.filter(isShellCall).map(commandOf)
  return { seen, hits: seen.filter((c) => matches(c, command)) }
}

/**
 * The workspace files that changed while the agent ran a turn, set on each turn `c.send` returns.
 * Not the turn's `diff`, which also has earlier turns' changes and the eval's own writes.
 */
export const TURN_EDITED: unique symbol = Symbol('reeval.turnEdited')

/**
 * Raw mid-turn status on a frozen `Turn`, so wire serializers can copy it without going through
 * the `status` getter that marks the body as having inspected the error.
 */
export const TURN_STATUS: unique symbol = Symbol('reeval.turnStatus')

/** The paths the trajectory's write and edit tool calls touched, once each, matching `path`. */
export const editedPaths = (trajectory: TrajectoryEvent[], path?: RegExp | string): string[] =>
  [...new Set(editsOf(trajectory).map((e) => e.path))].filter((p) => matches(p, path))

/** Whether `content` has `pattern`: a substring, or a match of a regular expression. */
export const contentMatches = (content: string, pattern: RegExp | string): boolean =>
  typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content)

export type PathMatch = string | RegExp | ReadonlyArray<string | RegExp>

/** A glob also matches every file under the directory it names, so `test` is `test/**` too. */
const pathTest = (pattern: string | RegExp): ((path: string) => boolean) => {
  if (pattern instanceof RegExp) return (path) => pattern.test(path)
  const glob = pattern.replace(/^\.?\/+/, '').replace(/\/+$/, '')
  const self = picomatch(glob, { dot: true })
  const inside = picomatch(`${glob}/**`, { dot: true })
  return (path) => self(path) || inside(path)
}

const pathPatterns = (paths: PathMatch | undefined): Array<string | RegExp> =>
  paths === undefined
    ? []
    : typeof paths === 'string' || paths instanceof RegExp
      ? [paths]
      : [...paths]

/** The diff's files under any of `paths` (every file without any): a glob also takes its directory's files. */
export function changesIn(files: readonly FileChange[], paths?: PathMatch): FileChange[] {
  const tests = pathPatterns(paths).map(pathTest)
  return files.filter((f) => tests.length === 0 || tests.some((t) => t(f.path)))
}

/** `withinLimits()`'s limits: each one caps what the turn, or every turn of `c`, used. */
export type Limits = {
  /** Input (cache included) plus output tokens, subagents included. */
  tokens?: number
  /** Every tool call, or each listed tool's calls by name as `toHaveCalledTool` names them. */
  toolCalls?: number | Readonly<Record<string, number>>
  /** The agent's time, as `turn.durationMs` counts it; setup and checks don't count. */
  duration?: Duration
}

export type BudgetSubject = Pick<Turn, 'usage' | 'trajectory' | 'durationMs'>

const count = (n: number) => n.toLocaleString('en-US')

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0

const andList = (keys: readonly string[]) =>
  keys.length > 1 ? `${keys.slice(0, -1).join(', ')} and ${keys.at(-1)}` : keys.join('')

const shown = (v: unknown) => (typeof v === 'number' ? String(v) : JSON.stringify(v))

/**
 * What's wrong with `limits` for `who` (`withinLimits()`), which takes `keys`; undefined when
 * nothing is. `cost` is US dollars, for the checks that take it.
 */
export function limitsProblem(
  limits: unknown,
  who: string,
  keys: readonly string[],
  example: string,
): string | undefined {
  if (!isObjectLike(limits) || Array.isArray(limits)) {
    return `${who} takes limits, ${example} (got ${JSON.stringify(limits)})`
  }
  for (const key of Object.keys(limits)) {
    if (keys.includes(key)) continue
    const near = closest(key, [...keys])
    return `${who} has no limit "${key}"; it takes ${andList(keys)}.${near ? ` Did you mean "${near}"?` : ''}`
  }
  if (!keys.some((k) => limits[k] !== undefined))
    return `${who} needs at least one limit, ${example}`
  const bad = (what: string, value: unknown) =>
    `${who}'s ${what} is a whole number of 0 or more (got ${shown(value)})`
  if (limits.tokens !== undefined && !isCount(limits.tokens)) return bad('tokens', limits.tokens)
  const calls = limits.toolCalls
  if (calls !== undefined && !isCount(calls)) {
    if (!isObjectLike(calls) || !Object.keys(calls).length) {
      return `${who}'s toolCalls is a count, or a count per tool such as { bash: 10 } (got ${shown(calls)})`
    }
    for (const [tool, n] of Object.entries(calls)) {
      if (!isCount(n)) return bad(`toolCalls.${tool}`, n)
    }
  }
  if (limits.duration !== undefined) {
    try {
      parseDuration(limits.duration as Duration)
    } catch (error) {
      return `${who}'s duration: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  const cost = limits.cost
  if (cost !== undefined && !(typeof cost === 'number' && Number.isFinite(cost) && cost >= 0)) {
    return `${who}'s cost is US dollars, a number of 0 or more (got ${shown(cost)})`
  }
  return undefined
}

/**
 * What `turns` used, as `withinLimits()` counts it: input (cache included) plus output tokens, null
 * when a turn's harness reported none; tool calls, in all and by tool name; the agent's time.
 */
export function budgetUsed(turns: readonly BudgetSubject[]): {
  tokens: number | null
  toolCalls: number
  callsOf: (tool: string) => number
  durationMs: number
} {
  const trajectory = turns.flatMap((t) => t.trajectory)
  return {
    tokens: turns.some((t) => t.usage === null)
      ? null
      : turns.reduce((sum, t) => sum + totalTokens(t.usage as TokenUsage), 0),
    toolCalls: trajectory.filter((e) => 'toolCallId' in e).length,
    callsOf: (tool) => toolsOf(trajectory).filter((e) => e.tool === tool).length,
    durationMs: turns.reduce((sum, t) => sum + t.durationMs, 0),
  }
}

/**
 * Each limit `used` went over, as `withinLimits()` says it: `tokens 210,000 > 200,000`. Only the
 * limits set are checked, so `used` needs only those.
 */
export function overLimits(
  used: {
    tokens: number
    toolCalls: number
    callsOf: (tool: string) => number
    durationMs: number
    cost?: number
  },
  limits: Limits & { cost?: number },
): string[] {
  const over: string[] = []
  if (limits.tokens !== undefined && used.tokens > limits.tokens) {
    over.push(`tokens ${count(used.tokens)} > ${count(limits.tokens)} (subagents included)`)
  }
  const calls = limits.toolCalls
  if (typeof calls === 'number') {
    if (used.toolCalls > calls) over.push(`toolCalls ${count(used.toolCalls)} > ${count(calls)}`)
  } else if (calls) {
    for (const [tool, limit] of Object.entries(calls)) {
      const n = used.callsOf(tool)
      if (n > limit) over.push(`${tool} ${count(n)} > ${count(limit)}`)
    }
  }
  if (limits.duration !== undefined && used.durationMs > parseDuration(limits.duration)) {
    over.push(`duration ${formatDuration(used.durationMs)} > ${String(limits.duration)}`)
  }
  if (limits.cost !== undefined && (used.cost ?? 0) > limits.cost) {
    over.push(`cost $${used.cost} > $${limits.cost}`)
  }
  return over
}
