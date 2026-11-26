import picomatch from 'picomatch'
import { closest } from './contract/shared.ts'
import { parseDuration } from './duration.ts'
import { skillsUsed } from './history/tool-class.ts'
import { loadedSkill, targetText, toolTarget } from './history/tool-target.ts'
import { isObjectLike } from './object.ts'
import { commandOf, isShellCall, transcriptCommands } from './shell-commands.ts'
import { formatDuration } from './text.ts'
import type {
  AttemptContext,
  Duration,
  FileChange,
  TokenUsage,
  TranscriptEvent,
  Turn,
  WebEventType,
} from './types.ts'
import { totalTokens } from './usage.ts'

export type Result = {
  pass: boolean
  message: () => string
  /** File matcher target (`toHaveFile`), as recorded on the assertion. */
  target?: string
  /** Passing file check that the agent didn't satisfy (path already matched). */
  preSatisfied?: boolean
}

/**
 * A matcher handed a subject it can't read, such as `toHaveEdited(1)`: recorded as `error`, an
 * answer it couldn't give, so the eval's own `TypeError`s stay errors that end the attempt.
 */
export function subjectError(message: string): TypeError {
  return Object.assign(new TypeError(message), { [Symbol.for('reeval.subjectError')]: true })
}

/**
 * A matcher called wrong, such as `toStayWithin()` with no limit: not a check that ran, so it
 * isn't recorded as one, and the `TypeError` ends the attempt as the eval's own would.
 */
export function misuseError(message: string): TypeError {
  return Object.assign(new TypeError(message), { [Symbol.for('reeval.misuse')]: true })
}

export const isMisuse = (error: unknown): boolean =>
  error instanceof TypeError && Symbol.for('reeval.misuse') in error

/** A check the turn's harness can't answer either way, e.g. a web fetch it never reports. */
export class HarnessCapabilityError extends Error {
  override name = 'HarnessCapabilityError'
}

export type ToolInputMatch = string | RegExp | Record<string, unknown>

type ToolEvent = Extract<TranscriptEvent, { type: 'tool' }>

export type Subject = Pick<Turn, 'transcript' | 'unreported'>

const isTurn = (value: unknown): value is Subject =>
  isObjectLike(value) && Array.isArray(value.transcript) && Array.isArray(value.unreported)

const isContext = (value: unknown): value is Pick<AttemptContext, 'turns'> =>
  isObjectLike(value) && Array.isArray(value.turns)

/** A turn from `c.send()`, or `c` (every turn so far). */
export function transcriptSubject(actual: unknown, matcher: string): Subject {
  if (isTurn(actual)) return actual
  if (isContext(actual)) {
    return {
      transcript: actual.turns.flatMap((t) => t.transcript),
      unreported: [...new Set(actual.turns.flatMap((t) => t.unreported))],
    }
  }
  throw subjectError(`${matcher}() expects a turn from c.send(), or c`)
}

const matches = (value: string, pattern: RegExp | string | undefined) =>
  pattern === undefined ||
  (typeof pattern === 'string' ? value.includes(pattern) : pattern.test(value))

const listed = (values: string[]) => (values.length ? JSON.stringify(values) : 'none')

const targetOf = (pattern: RegExp | string | undefined) =>
  pattern === undefined ? '' : ` matching ${pattern}`

const record = (value: unknown): Record<string, unknown> => (isObjectLike(value) ? value : {})

const toolsOf = (transcript: TranscriptEvent[]) =>
  transcript.flatMap((e) => (e.type === 'tool' ? [e] : []))

const editsOf = (transcript: TranscriptEvent[]) =>
  transcript.flatMap((e) => (e.type === 'file-edit' ? [e] : []))

const skillLike = (event: ToolEvent): string | undefined => {
  const loaded = loadedSkill(event.tool, event.input)
  if (loaded) return `${event.tool}:${loaded}`
  const target = toolTarget(event.input, event.tool)
  if (target.includes('skills/')) return `${event.tool} ${target}`
}

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

const WEB_FIELD: Record<WebEventType, (e: TranscriptEvent) => string> = {
  'web-search': (e) => ('query' in e ? e.query : ''),
  'web-fetch': (e) => ('url' in e ? e.url : ''),
}

/**
 * The queries (`web-search`) or URLs (`web-fetch`) the transcript has, all of them and those
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
  const seen = subject.transcript.filter((e) => e.type === type).map(WEB_FIELD[type])
  return { seen, hits: seen.filter((v) => matches(v, pattern)) }
}

function webEvent(
  matcher: string,
  actual: unknown,
  type: WebEventType,
  pattern: RegExp | string | undefined,
): Result {
  const what = type === 'web-search' ? 'web searches' : 'web fetches'
  const subject = transcriptSubject(actual, matcher)
  const { seen, hits } = webEvents(subject, type, pattern, `${matcher}()`)
  const pass = hits.length > 0
  return {
    pass,
    message: () =>
      pass
        ? `expected no ${what}${targetOf(pattern)}, got ${listed(seen)}`
        : `expected ${what}${targetOf(pattern)}, got ${listed(seen)}`,
  }
}

/** The transcript's tool calls that used the skill `name`. */
export const skillCalls = (transcript: TranscriptEvent[], name: string): ToolEvent[] =>
  toolsOf(transcript).filter((e) => isSkillCall(e, name))

/** Which of the `placed` skills the transcript's tool calls used, in order of first use. */
export const placedSkillsUsed = (
  transcript: TranscriptEvent[],
  placed: readonly string[],
): string[] => [
  ...new Set(
    toolsOf(transcript).flatMap((e) => skillsUsed(e.tool, targetText(e.input, e.tool), placed)),
  ),
]

export function calledSkill(actual: unknown, name: string): Result {
  const { transcript } = transcriptSubject(actual, 'toHaveCalledSkill')
  const calls = toolsOf(transcript)
  const seen = calls.flatMap((e) => {
    const label = skillLike(e)
    return label ? [label] : []
  })
  const pass = skillCalls(transcript, name).length > 0
  return {
    pass,
    message: () =>
      pass
        ? `expected no skill-like calls matching ${name}, got ${listed(seen)}`
        : `expected skill-like calls matching ${name}, got ${listed(seen)}`,
  }
}

/** The transcript's tool calls named `name`, whose input matches `input` when given. */
export const toolCalls = (
  transcript: TranscriptEvent[],
  name: string | RegExp,
  input?: ToolInputMatch,
): ToolEvent[] =>
  toolsOf(transcript).filter((e) => nameMatches(e.tool, name) && inputMatches(e.input, input))

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The transcript's calls to the MCP server `server`'s tools, or to its `tool`. */
export const mcpCalls = (
  transcript: TranscriptEvent[],
  server: string,
  tool?: string,
  input?: ToolInputMatch,
): ToolEvent[] =>
  toolCalls(
    transcript,
    tool === undefined ? new RegExp(`^mcp__${escapeRegExp(server)}__.`) : `mcp__${server}__${tool}`,
    input,
  )

export function calledTool(actual: unknown, name: string | RegExp, input?: ToolInputMatch): Result {
  const { transcript } = transcriptSubject(actual, 'toHaveCalledTool')
  const calls = toolsOf(transcript)
  const inputPart = input === undefined ? '' : ` with input ${formatInput(input)}`
  const seen = calls.map((e) =>
    input === undefined ? e.tool : `${e.tool} ${JSON.stringify(e.input)}`,
  )
  const pass = toolCalls(transcript, name, input).length > 0
  return {
    pass,
    message: () =>
      pass
        ? `expected no tool calls matching ${name}${inputPart}, got ${listed(seen)}`
        : `expected tool calls matching ${name}${inputPart}, got ${listed(seen)}`,
  }
}

const MCP_NAME = /^mcp__(.+)__(.+)$/

const mcpLabel = (tool: string) => {
  const m = MCP_NAME.exec(tool)
  return m ? `${m[1]}/${m[2]}` : tool
}

/** `type: 'tool'` named `mcp__<server>__<tool>` after adapters and the normalizer. */
export function calledMcp(
  actual: unknown,
  server: string,
  tool: string,
  input?: ToolInputMatch,
): Result {
  const subject = transcriptSubject(actual, 'toHaveCalledMcp')
  const pass = mcpCalls(subject.transcript, server, tool, input).length > 0
  const all = toolsOf(subject.transcript).filter((e) => e.tool.startsWith('mcp__'))
  const inputPart = input === undefined ? '' : ` with input ${formatInput(input)}`
  const seen = all.map((e) =>
    input === undefined ? mcpLabel(e.tool) : `${mcpLabel(e.tool)} ${JSON.stringify(e.input)}`,
  )
  return {
    pass,
    message: () =>
      pass
        ? `expected no MCP calls matching ${server}/${tool}${inputPart}, got ${listed(seen)}`
        : `expected MCP calls matching ${server}/${tool}${inputPart}, got ${listed(seen)}`,
  }
}

function formatInput(input: ToolInputMatch): string {
  if (typeof input === 'string' || input instanceof RegExp) return String(input)
  return JSON.stringify(input)
}

/** `toHaveRun`'s object form: the program a segment of a shell command ran, after its wrappers. */
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
  const example = "e.g. toHaveRun({ program: 'genkit', args: /^flow:run\\b/ })"
  for (const key of Object.keys(match)) {
    if ((RUN_MATCH_KEYS as readonly string[]).includes(key)) continue
    const near = closest(key, RUN_MATCH_KEYS)
    throw misuseError(
      `toHaveRun() has no "${key}"; it takes program and args.${near ? ` Did you mean "${near}"?` : ''}`,
    )
  }
  if (!isPatternArg(match.program) || match.program === '') {
    throw misuseError(
      `toHaveRun()'s program is a program name or a regular expression, ${example} (got ${JSON.stringify(match.program)})`,
    )
  }
  if (match.args !== undefined && !isPatternArg(match.args)) {
    throw misuseError(
      `toHaveRun()'s args is text or a regular expression, ${example} (got ${JSON.stringify(match.args)})`,
    )
  }
  return match as RunMatch
}

/**
 * `toHaveRun({ program, args })`'s default label, `program genkit args /^flow:run\b/`: unlike
 * `toHaveRun('genkit')`'s, so switching an eval to the object form starts a new history key.
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
 * The commands the transcript ran, all of them and those matching `command`: shell commands by
 * their text, or with a `RunMatch`, each program a segment of one ran, after its wrappers.
 */
export function commandsRun(
  transcript: TranscriptEvent[],
  command?: RegExp | string | RunMatch,
): { seen: string[]; hits: string[] } {
  if (isObjectLike(command) && !(command instanceof RegExp)) {
    const match = checkRunMatch(command)
    const commands = transcriptCommands(transcript)
    const hits = commands.filter(
      (c) =>
        (typeof match.program === 'string'
          ? c.program === match.program
          : match.program.test(c.program)) && matches(c.args.join(' '), match.args),
    )
    return { seen: commands.map(shownCommand), hits: hits.map(shownCommand) }
  }
  const seen = transcript.filter(isShellCall).map(commandOf)
  return { seen, hits: seen.filter((c) => matches(c, command)) }
}

export function ran(actual: unknown, command?: RegExp | string | RunMatch): Result {
  const { transcript } = transcriptSubject(actual, 'toHaveRun')
  const { seen, hits } = commandsRun(transcript, command)
  if (isObjectLike(command) && !(command instanceof RegExp)) {
    const match = command as RunMatch
    const argsPart = match.args === undefined ? '' : ` with args matching ${match.args}`
    const target = `${match.program}${argsPart}`
    return {
      pass: hits.length > 0,
      message: () =>
        hits.length > 0
          ? `expected no runs of ${target}, got ${listed(hits)}`
          : `expected runs of ${target}, got ${listed(seen)}`,
    }
  }
  const pass = hits.length > 0
  return {
    pass,
    message: () =>
      pass
        ? `expected no shell commands${targetOf(command)}, got ${listed(seen)}`
        : `expected shell commands${targetOf(command)}, got ${listed(seen)}`,
  }
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

const editedIn = (turn: unknown): string[] => {
  if (!isObjectLike(turn)) return []
  const own = (turn as { [TURN_EDITED]?: unknown })[TURN_EDITED]
  if (Array.isArray(own)) return own
  return hasDiff(turn) ? turn.diff.files.map((f) => f.path) : []
}

/** The paths the transcript's write and edit tool calls touched, once each, matching `path`. */
export const editedPaths = (transcript: TranscriptEvent[], path?: RegExp | string): string[] =>
  [...new Set(editsOf(transcript).map((e) => e.path))].filter((p) => matches(p, path))

/** Whether `content` has `pattern`: a substring, or a match of a regular expression. */
export const contentMatches = (content: string, pattern: RegExp | string): boolean =>
  typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content)

/**
 * Edit tools' `file-edit` events and the files the turn changed in the workspace, so a file
 * written from the shell or by a script counts, and one only read doesn't.
 */
export function edited(actual: unknown, path?: RegExp | string): Result {
  const { transcript } = transcriptSubject(actual, 'toHaveEdited')
  const changed = isContext(actual) ? actual.turns.flatMap(editedIn) : editedIn(actual)
  const seen = [...new Set([...editedPaths(transcript), ...changed])]
  const pass = seen.some((p) => matches(p, path))
  return {
    pass,
    message: () =>
      pass
        ? `expected no file edits${targetOf(path)}, got ${listed(seen)}`
        : `expected file edits${targetOf(path)}, got ${listed(seen)}`,
  }
}

export type PathMatch = string | RegExp | ReadonlyArray<string | RegExp>

const hasDiff = (value: unknown): value is Pick<Turn, 'diff'> =>
  isObjectLike(value) && isObjectLike(value.diff) && Array.isArray(value.diff.files)

/** A turn's changed files, or `c`'s as of its latest turn: the diff is cumulative. */
function changedFiles(actual: unknown): FileChange[] {
  if (hasDiff(actual)) return actual.diff.files
  if (isContext(actual)) return actual.turns.at(-1)?.diff.files ?? []
  throw subjectError('toHaveChanged() expects a turn from c.send(), or c')
}

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

/** Files in the workspace diff, so every write counts: a tool's, a shell command's or a subprocess's. */
export function changed(actual: unknown, paths?: PathMatch): Result {
  const files = changedFiles(actual)
  const patterns = pathPatterns(paths)
  const hits = changesIn(files, paths)
  const label = (list: FileChange[]) =>
    list.length
      ? `[${list.map((f) => `${JSON.stringify(f.path)} (${f.status})`).join(', ')}]`
      : 'none'
  const target = patterns.length ? ` to ${patterns.map(String).join(', ')}` : ''
  return {
    pass: hits.length > 0,
    message: () =>
      hits.length > 0
        ? `expected no changes${target}, got ${label(hits)}`
        : `expected changes${target}, got ${label(files)}`,
  }
}

export function searched(actual: unknown, query?: RegExp | string): Result {
  return webEvent('toHaveSearched', actual, 'web-search', query)
}

export function fetched(actual: unknown, url?: RegExp | string): Result {
  return webEvent('toHaveFetched', actual, 'web-fetch', url)
}

/** `toStayWithin`'s limits: each one caps what the turn, or every turn of `c`, used. */
export type Limits = {
  /** Input (cache included) plus output tokens, subagents included. */
  tokens?: number
  /** Every tool call, or each listed tool's calls by name as `toHaveCalledTool` names them. */
  toolCalls?: number | Readonly<Record<string, number>>
  /** The agent's time, as `turn.durationMs` counts it; setup and checks don't count. */
  duration?: Duration
}

const LIMIT_KEYS = ['tokens', 'toolCalls', 'duration'] as const

export type BudgetSubject = Pick<Turn, 'usage' | 'transcript' | 'durationMs'>

const isBudgetTurn = (value: unknown): value is BudgetSubject =>
  isObjectLike(value) && Array.isArray(value.transcript) && typeof value.durationMs === 'number'

const count = (n: number) => n.toLocaleString('en-US')

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0

/** The limits as `toStayWithin`'s default label shows them: `tokens 200,000, bash 10`. */
export function limitsLabel(limits: unknown): string | undefined {
  if (!isObjectLike(limits)) return undefined
  const parts: string[] = []
  if (isCount(limits.tokens)) parts.push(`tokens ${count(limits.tokens)}`)
  const calls = limits.toolCalls
  if (isCount(calls)) parts.push(`toolCalls ${count(calls)}`)
  else if (isObjectLike(calls)) {
    for (const [tool, n] of Object.entries(calls)) {
      parts.push(`${tool} ${isCount(n) ? count(n) : String(n)}`)
    }
  }
  if (limits.duration !== undefined) parts.push(`duration ${String(limits.duration)}`)
  return parts.length ? parts.join(', ') : undefined
}

const andList = (keys: readonly string[]) =>
  keys.length > 1 ? `${keys.slice(0, -1).join(', ')} and ${keys.at(-1)}` : keys.join('')

const shown = (v: unknown) => (typeof v === 'number' ? String(v) : JSON.stringify(v))

/**
 * What's wrong with `limits` for `who` (`toStayWithin()`), which takes `keys`; undefined when
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

function checkLimits(limits: unknown): Limits {
  const example = 'e.g. toStayWithin({ tokens: 200_000, toolCalls: { bash: 10 } })'
  const problem = limitsProblem(limits, 'toStayWithin()', LIMIT_KEYS, example)
  if (problem) throw misuseError(problem)
  return limits as Limits
}

/**
 * What `turns` used, as `toStayWithin` counts it: input (cache included) plus output tokens, null
 * when a turn's harness reported none; tool calls, in all and by tool name; the agent's time.
 */
export function budgetUsed(turns: readonly BudgetSubject[]): {
  tokens: number | null
  toolCalls: number
  callsOf: (tool: string) => number
  durationMs: number
} {
  const transcript = turns.flatMap((t) => t.transcript)
  return {
    tokens: turns.some((t) => t.usage === null)
      ? null
      : turns.reduce((sum, t) => sum + totalTokens(t.usage as TokenUsage), 0),
    toolCalls: transcript.filter((e) => 'toolCallId' in e).length,
    callsOf: (tool) => toolsOf(transcript).filter((e) => e.tool === tool).length,
    durationMs: turns.reduce((sum, t) => sum + t.durationMs, 0),
  }
}

/**
 * Each limit `used` went over, as `toStayWithin` says it: `tokens 210,000 > 200,000`. Only the
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

/**
 * `toStayWithin`: what the turn, or every turn of `c`, used, against each limit. A null `usage`
 * can't show it stayed within `tokens`, so that's a `HarnessCapabilityError`, not a failure.
 */
export function withinLimits(actual: unknown, limits: unknown, not: boolean): Result {
  if (not) {
    throw misuseError(
      "toStayWithin() can't be negated: a budget checks the agent stayed within it. Check the figure itself instead, e.g. expect(turn.usage.output).toBeGreaterThan(…).",
    )
  }
  const turns: readonly BudgetSubject[] = isBudgetTurn(actual)
    ? [actual]
    : isContext(actual)
      ? actual.turns
      : (() => {
          throw subjectError('toStayWithin() expects a turn from c.send(), or c')
        })()
  const checked = checkLimits(limits)
  const used = budgetUsed(turns)
  if (checked.tokens !== undefined && used.tokens === null) {
    throw new HarnessCapabilityError(
      "toStayWithin() can't check tokens: the harness reported no token usage for this turn (turn.usage is null). Drop tokens, or use a harness that reports usage.",
    )
  }
  const over = overLimits({ ...used, tokens: used.tokens ?? 0 }, checked)
  return {
    pass: over.length === 0,
    message: () =>
      over.length ? `went over its budget: ${over.join(' · ')}` : 'stayed within its budget',
  }
}
