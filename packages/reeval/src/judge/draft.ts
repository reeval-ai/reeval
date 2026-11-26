import { globFilter } from '../environment.ts'
import type {
  Diff,
  ExecResult,
  JSONValue,
  Observation,
  ResolvedJudgeStateOptions,
  TurnData,
} from '../types.ts'
import { judgeDiff } from './patch.ts'
import type { Draft, DraftTurn } from './state.ts'
import { type JudgeSubagent, trajectoryForJudge } from './trajectory.ts'

/** A turn as the judge's state reads it. */
export type DraftSource = Pick<TurnData, 'prompt' | 'text' | 'trajectory'> & {
  subagents?: readonly JudgeSubagent[]
}

/** What the judge's state is drawn from: an attempt's turns, diff, execs, observations and files. */
export type DraftSources = {
  turns: readonly DraftSource[]
  /** The graded turn's index in `turns`. */
  subject: number
  /** What `output` shows: the graded turn's text, or a value. */
  output: JSONValue
  /** The workspace's changes up to the graded turn. */
  diff: Diff
  wanted: ResolvedJudgeStateOptions
  checks: ReadonlyArray<{ command: string } & ExecResult>
  observations: readonly Observation[] | undefined
  readFile: (path: string) => Promise<string | null>
  listFiles: () => Promise<string[]>
  /** Names the caller in a refusal: `c.state()`. */
  who: string
}

const workspacePath = (path: string) => path.replace(/^\.\//, '')

/** A `contents` entry that names one file rather than matching many. */
const isExactPath = (entry: string) => !entry.startsWith('!') && !/[*?[\]{}]/.test(entry)

/**
 * The judge's state for the inputs turned on: the graded turn's task and output (or every
 * turn's), its changed files and diff as `judgeDiff` shows them, files whole, `c.exec` results and
 * the trajectory.
 */
export async function draftState(src: DraftSources): Promise<{ draft: Draft; dropped: string[] }> {
  const { wanted } = src
  const graded =
    wanted.turns === 'all' ? src.turns.slice(0, src.subject + 1) : [src.turns[src.subject]]
  const turns: DraftTurn[] = graded.map((turn, i) => {
    const subject = wanted.turns !== 'all' || i === src.subject
    return {
      ...(wanted.task ? { task: turn?.prompt } : {}),
      ...(wanted.output ? { output: subject ? src.output : turn?.text } : {}),
      ...(wanted.trajectory && turn
        ? {
            trajectory: trajectoryForJudge(turn.trajectory, wanted.trajectory, turn.subagents).join(
              '\n',
            ),
          }
        : {}),
    }
  })
  const contents = await filesWhole(wanted.contents, src)
  const shown = judgeDiff(src.diff, {
    ...(Array.isArray(wanted.diff) ? { patterns: wanted.diff } : {}),
    ...(contents ? { inFull: new Set(Object.keys(contents)) } : {}),
  })
  const checks = checksShown(wanted.checks, src.checks, src.who)
  const observations = observationsShown(wanted.observations, src.observations)
  const draft: Draft = {
    all: wanted.turns === 'all',
    turns,
    ...(wanted.files ? { files: shown.files } : {}),
    ...(wanted.diff !== false ? { diff: shown.patch } : {}),
    ...(contents ? { contents } : {}),
    ...(checks ? { checks } : {}),
    ...(observations ? { observations } : {}),
  }
  return { draft, dropped: wanted.diff !== false ? shown.dropped : [] }
}

/** Exact paths (`null` when missing) and every workspace file the patterns match, in path order. */
async function filesWhole(
  entries: readonly string[],
  src: Pick<DraftSources, 'readFile' | 'listFiles'>,
): Promise<Record<string, string | null> | undefined> {
  if (!entries.length) return undefined
  const exact = entries.filter(isExactPath).map(workspacePath)
  const matches = globFilter(entries.map(workspacePath))
  const matched = entries.some((e) => !isExactPath(e))
    ? (await src.listFiles()).filter((path) => matches(path))
    : []
  const paths = [...new Set([...exact, ...matched])].sort()
  const contents: Record<string, string | null> = {}
  for (const path of paths) {
    const text = await src.readFile(path)
    contents[path] = text?.includes('\u0000') ? '[reeval: dropped binary file]' : text
  }
  return contents
}

function checksShown(
  which: ResolvedJudgeStateOptions['checks'],
  ran: DraftSources['checks'],
  who: string,
): Draft['checks'] {
  if (which === false) return undefined
  if (which !== true) {
    const missing = which.find((command) => !ran.some((r) => r.command === command))
    if (missing !== undefined) {
      throw new Error(
        `${who} checks names a command this attempt hasn't run: ${JSON.stringify(missing)}`,
      )
    }
  }
  return ran
    .filter((r) => which === true || which.includes(r.command))
    .map(({ command, exitCode, stdout, stderr }) => ({ command, exitCode, stdout, stderr }))
}

function observationsShown(
  which: ResolvedJudgeStateOptions['observations'],
  observed: DraftSources['observations'] = [],
): Draft['observations'] {
  if (!which) return undefined
  return Object.fromEntries(
    observed.filter((o) => which === true || which.includes(o.name)).map((o) => [o.name, o.value]),
  )
}
