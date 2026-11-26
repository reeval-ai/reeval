// `reeval/graders/match`: the built-in graders' logic as plain functions of a grader's `c`, each
// returning the grade alone, for a `defineGrader`. reeval's built-in graders grade with them, and
// find their evidence with the same functions in assert.ts.
import {
  budgetUsed,
  changesIn,
  commandsRun,
  contentMatches,
  editedPaths,
  mcpCalls,
  type PathMatch,
  placedSkillsUsed,
  type RunMatch,
  type Subject,
  skillCalls,
  type ToolInputMatch,
  toolCalls,
  webEvents,
} from '../assert.ts'
import type { ExecLine } from '../history/types.ts'
import { totalTokens } from '../usage.ts'
import { GradeError, MissingFileError } from './context.ts'
import type { GraderContext } from './types.ts'

export type { PathMatch, RunMatch, ToolInputMatch }

type Turns = Pick<GraderContext, 'turns'>

/** Every turn's trajectory, and the events any turn's harness couldn't report. */
const subject = (c: Turns): Subject => ({
  trajectory: c.turns.flatMap((t) => t.trajectory),
  unreported: [...new Set(c.turns.flatMap((t) => t.unreported))],
})

const trajectory = (c: Turns) => c.turns.flatMap((t) => t.trajectory)

/** Whether a tool call used the skill `name`, as `toHaveCalledSkill` decides it. */
export function calledSkill(c: Turns, name: string): boolean {
  return skillCalls(trajectory(c), name).length > 0
}

/** The skills the environment placed that the agent's tool calls used, in order of first use. */
export function usedSkills(c: Turns & Pick<GraderContext, 'skills'>): string[] {
  return placedSkillsUsed(trajectory(c), c.skills)
}

/** How many tool calls were named `name`, with an input matching `input` when given. */
export function calledTool(c: Turns, name: string | RegExp, input?: ToolInputMatch): number {
  return toolCalls(trajectory(c), name, input).length
}

/** How many calls went to the MCP server `server`, or to its `tool`. */
export function calledMcp(c: Turns, server: string, tool?: string, input?: ToolInputMatch): number {
  return mcpCalls(trajectory(c), server, tool, input).length
}

/** How many shell commands matched `command`; a `RunMatch` counts the programs they ran. */
export function ran(c: Turns, command?: string | RegExp | RunMatch): number {
  return commandsRun(trajectory(c), command).hits.length
}

/** How many web searches matched `query`. Throws when a turn's harness doesn't report them. */
export function searched(c: Turns, query?: string | RegExp): number {
  return webEvents(subject(c), 'web-search', query, 'searched').hits.length
}

/** How many web fetches matched `url`. Throws when a turn's harness doesn't report them. */
export function fetched(c: Turns, url?: string | RegExp): number {
  return webEvents(subject(c), 'web-fetch', url, 'fetched').hits.length
}

/**
 * The paths the agent's write and edit tool calls touched, matching `path`: a file written and
 * later reverted counts, one a command it ran changed doesn't.
 */
export function wrote(c: Turns, path?: string | RegExp): string[] {
  return editedPaths(trajectory(c), path)
}

/**
 * The paths in the final diff under any of `paths` (every one without any), however they
 * changed: a glob also takes the files of the directory it names.
 */
export function inDiff(c: Pick<GraderContext, 'changedFiles'>, paths?: PathMatch): string[] {
  return changesIn(c.changedFiles, paths).map((f) => f.path)
}

/**
 * Whether the kept workspace has `path`, with `content` in it when given. `path` must be in the
 * grader's `files`.
 */
export async function hasFile(
  c: Pick<GraderContext, 'readFile'>,
  path: string,
  content?: string | RegExp,
): Promise<boolean> {
  let text: string
  try {
    text = await c.readFile(path)
  } catch (error) {
    if (error instanceof MissingFileError) return false
    throw error
  }
  return content === undefined || contentMatches(text, content)
}

/** The last `c.exec` labeled `commandOrLabel`, else the last that ran it; undefined for none. */
export function execOf(
  c: Pick<GraderContext, 'execs'>,
  commandOrLabel: string,
): ExecLine | undefined {
  return (
    c.execs.findLast((e) => e.label === commandOrLabel) ??
    c.execs.findLast((e) => e.command === commandOrLabel)
  )
}

/** The exit code of the `c.exec` `execOf` finds. Throws when the task ran none. */
export function succeeded(c: Pick<GraderContext, 'execs'>, commandOrLabel: string): number {
  const exec = execOf(c, commandOrLabel)
  if (!exec) {
    const ran = [...new Set(c.execs.map((e) => e.label ?? e.command))]
    throw new GradeError(
      `the task ran no c.exec labeled or running ${JSON.stringify(commandOrLabel)} (it ran ${ran.length ? ran.map((r) => JSON.stringify(r)).join(', ') : 'none'})`,
    )
  }
  return exec.exitCode
}

/** What the attempt's turns used. */
export type Usage = {
  turns: number
  /** Input (cache included) plus output tokens, subagents included; null when a turn's harness reported none. */
  tokens: number | null
  /** Every tool call. */
  toolCalls: number
  /** The agent's time over its turns. */
  durationMs: number
  /**
   * The turns' cost in US dollars, as the record keeps it: reported, else estimated at list
   * prices; null when a turn that used tokens has neither.
   */
  cost: number | null
}

/** What the attempt's turns used: their count, tokens, tool calls, time and cost. */
export function usage(c: Turns): Usage {
  const used = budgetUsed(c.turns)
  return {
    turns: c.turns.length,
    tokens: used.tokens,
    toolCalls: used.toolCalls,
    durationMs: used.durationMs,
    cost: c.turns.some((t) => !t.cost && (t.usage === null || totalTokens(t.usage) > 0))
      ? null
      : c.turns.reduce((sum, t) => sum + (t.cost?.usd ?? 0), 0),
  }
}

/** The tool calls named `tool`. */
export function toolCallsOf(c: Turns, tool: string): number {
  return budgetUsed(c.turns).callsOf(tool)
}

/** A capture's page status, after redirects; null when no response came. */
export async function pageStatus(
  c: Pick<GraderContext, 'artifact'>,
  capture: string,
): Promise<number | null> {
  return (await c.artifact(capture)).capture?.status ?? null
}

/** How many uncaught exceptions and unhandled rejections a capture's page had. */
export async function pageErrors(
  c: Pick<GraderContext, 'artifact'>,
  capture: string,
): Promise<number> {
  return (await c.artifact(capture)).capture?.pageErrors ?? 0
}
