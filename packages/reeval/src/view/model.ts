import { sampleReasons } from '../compare/pairs.ts'
import type {
  CellRecord,
  EvalEntry,
  HistoryCell,
  HistoryEntry,
  RunRecord,
  TrialRecord,
} from '../history/types.ts'
import { blocks } from '../target.ts'
import { plural } from '../text.ts'
import type { DecisionRecord, Outcome, TokenUsage, TrajectoryEvent, TurnStatus } from '../types.ts'
import { formatTokens, promptTokens } from '../usage.ts'
import {
  type CompareCell,
  type CompareRow,
  type CompareStatus,
  cellsChanged,
  compare,
  type StackChange,
  stackChanges,
} from './compare.ts'
import { type CellEffort, cellContrast, cellEffort, type EffortContrast } from './effort.ts'
import { cellJudgeRates, cellUsage, type JudgeKeyRate, uniqueJudgeLabels } from './judgments.ts'
import { readableTrajectoryLine } from './record.ts'

// ── Formatting ───────────────────────────────────────────────────────────────────────────────

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '–'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export const formatPercent = (rate: number | null) =>
  rate === null ? '–' : `${Math.round(rate * 100)}%`

/**
 * A harness of the run's stack as `cursor (model composer-2.5, served composer-2.5[fast=true])`:
 * the configured model and reasoning effort, then what the harness says it resolved.
 */
export function harnessLabel(h: RunRecord['stack']['harnesses'][number]): string {
  const parts = [
    ...(h.model ? [`model ${h.model}`] : []),
    ...(h.effort ? [`reasoning effort ${h.effort}`] : []),
    ...(h.resolvedModels.length ? [`served ${h.resolvedModels.join(', ')}`] : []),
    ...(h.resolvedEffort.length ? [`served reasoning effort ${h.resolvedEffort.join(', ')}`] : []),
  ]
  return parts.length ? `${h.id} (${parts.join(', ')})` : h.id
}

/**
 * The runtime reeval ran on, as `node 22.14.0`, or `bun 1.4.2 (node 26.3.0)` with the Node version
 * it's compatible with. A run recorded before `stack.runtime` ran on Node.
 */
export function runtimeLabel(stack: Pick<RunRecord['stack'], 'node' | 'runtime'>): string {
  const runtime = stack.runtime ?? { name: 'node', version: stack.node }
  return runtime.name === 'node'
    ? `node ${runtime.version}`
    : `${runtime.name} ${runtime.version} (node ${stack.node})`
}

/** The evals' language as `typescript evals` or `dart 3.13.5 evals`; null when not recorded. */
export function languageLabel(stack: Pick<RunRecord['stack'], 'language'>): string | null {
  const language = stack.language
  if (!language) return null
  return `${language.version ? `${language.name} ${language.version}` : language.name} evals`
}

/** Harness-reported tokens as `127k in (98k cached) · 776 out`; null when none were reported. */
export function formatUsage(usage: TokenUsage | null | undefined): string | null {
  if (!usage) return null
  const cached = usage.cacheRead ? ` (${formatTokens(usage.cacheRead)} cached)` : ''
  return `${formatTokens(promptTokens(usage))} in${cached} · ${formatTokens(usage.output)} out`
}

export const shortSha = (sha: string | null | undefined) => (sha ? sha.slice(0, 7) : 'no git')

/** Reasoning time, or `n/a` when the harness couldn't measure it: never `0s` for unknown. */
export const reasoningLabel = (ms: number | null) => (ms === null ? 'n/a' : formatDuration(ms))

/**
 * A trial's effort: tool calls, its model calls when counted, then the files the workspace diff
 * changed, which counts a file the shell wrote, then the calls to the agent's edit tools, which
 * doesn't.
 */
export function activityLabel(
  a: Pick<TrialRecord['activity'], 'tools' | 'fileEdits'> &
    Partial<Pick<TrialRecord['activity'], 'llmCalls'>>,
  changed: number,
): string {
  const calls = a.llmCalls == null ? '' : ` · ${plural(a.llmCalls, 'LLM call')}`
  return `${plural(a.tools, 'tool call')}${calls} · ${plural(changed, 'file')} changed · ${plural(a.fileEdits, 'edit tool call')}`
}

// ── Trials list ────────────────────────────────────────────────────────────────────────────────

/**
 * A run's outcome, which `reeval run`'s exit code is read from: an error outside any trial, a
 * failed eval whose target blocks or a budget stop fails the run, while a compare's baselines and
 * an eval whose target doesn't block (`capability()`, the default) don't. An interrupted run is `skipped`, whatever ran; a resume its filters left
 * `interrupted` exits on its outcome as if it were complete.
 */
export function runOutcome(run: {
  status: RunRecord['status']
  evals: ReadonlyArray<Pick<EvalEntry, 'outcome' | 'target'>>
  errors?: readonly string[]
}): Outcome {
  if (run.status === 'interrupted') return 'skipped'
  if (run.errors?.length) return 'fail'
  const failed = run.evals.some(
    (e) => e.outcome === 'fail' && (e.target === undefined || blocks(e.target)),
  )
  const outcomes = run.evals.map((e) => e.outcome)
  if (failed || run.status === 'budget') return 'fail'
  if (outcomes.includes('infra_error')) return 'infra_error'
  return 'pass'
}

/**
 * The eval hasn't run yet: its run stopped (interrupted, or out of budget) or a filtered resume
 * left it out, and it's `skipped` without being a todo or declared skipped. A resume runs it.
 */
export const notRunYet = (
  run: Pick<RunRecord, 'status'>,
  e: Pick<EvalEntry, 'outcome' | 'todo' | 'skip'>,
): boolean => run.status !== 'complete' && e.outcome === 'skipped' && !e.todo && !e.skip

function andList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Distinct judge labels that failed on a counted trial, in first-seen order. */
export function failedJudgeLabels(record: Pick<RunRecord, 'evals'>): string[] {
  const seen = new Set<string>()
  const items: { key: string; question: string }[] = []
  for (const e of record.evals) {
    for (const a of e.trials) {
      if (a.outcome !== 'pass' && a.outcome !== 'fail') continue
      for (const j of a.judgements) {
        if (j.verdict !== 'fail' || seen.has(j.key)) continue
        seen.add(j.key)
        items.push({ key: j.key, question: j.question })
      }
    }
  }
  const labels = uniqueJudgeLabels(items)
  return items.map((item) => labels.get(item.key) ?? item.key)
}

/**
 * One sentence for the studio run header: counted pass/fail, which judges failed, and infra.
 * Works without `reeval explain`.
 */
export function runLead(record: Pick<RunRecord, 'summary' | 'evals'>): string {
  const { pass, fail, infraError } = record.summary
  const counted = pass + fail
  const judges = failedJudgeLabels(record)
  const parts: string[] = []
  if (counted === 0) parts.push('No counted trials')
  else {
    parts.push(`${pass} of ${counted} counted trials passed`)
    if (fail > 0) {
      parts.push(
        judges.length
          ? `${fail} failed the ${andList(judges)} judge${judges.length === 1 ? '' : 's'}`
          : `${fail} failed`,
      )
    }
  }
  if (infraError > 0) {
    parts.push(`${infraError} infra error${infraError === 1 ? '' : 's'}`)
  }
  return `${parts.join('; ')}.`
}

export type RunRow = {
  entry: HistoryEntry
  passed: number
  /** Trials that reached a verdict or errored; skips excluded. */
  total: number
  /** Passes and fails, the denominator of the run's pass@1. */
  counted: number
  /** Stack changes in the cells it shares with earlier runs, and in the judge since the previous complete run. */
  drift: StackChange[]
  /** Evals with a cell whose fingerprint changed since the last run that had that cell. */
  changedEvals: number
}

/**
 * Newest first. Drift is measured per cell, against the last run that had it: a run over fewer
 * cells (a filtered run) is no drift, and neither is the full run after it. The judge's settings
 * compare with the next older complete run.
 */
export function runRows(entries: HistoryEntry[]): RunRow[] {
  const oldest = [...entries].sort((a, b) => (a.runId < b.runId ? -1 : 1))
  const seen = new Map<string, string>()
  const lastCells = new Map<string, Map<string, HistoryCell>>()
  let previous: HistoryEntry | null = null
  const rows: RunRow[] = []
  for (const entry of oldest) {
    const { pass, fail, infraError } = entry.summary
    const base = previous && {
      stack: previous.stack,
      evals: [...lastCells].map(([id, cells]) => ({ id, cells: [...cells.values()] })),
    }
    let changedEvals = 0
    for (const e of entry.evals) {
      if (cellsChanged(seen, e.id, e.cells)) changedEvals++
      const cells = lastCells.get(e.id) ?? new Map<string, HistoryCell>()
      for (const c of e.cells) cells.set(c.key, c)
      lastCells.set(e.id, cells)
    }
    rows.push({
      entry,
      passed: pass,
      total: pass + fail + infraError,
      counted: pass + fail,
      drift: base ? stackChanges(base, entry) : [],
      changedEvals,
    })
    if (entry.status === 'complete') previous = entry
  }
  return rows.reverse()
}

// ── Run detail ───────────────────────────────────────────────────────────────────────────────

/** Trial counts; `missed` is ungated cells' failures, which `fail` leaves out. */
export type Tally = { pass: number; fail: number; missed: number; infra: number; skipped: number }

export type TreeNode =
  | { kind: 'group'; key: string; name: string; tally: Tally; children: TreeNode[] }
  | { kind: 'eval'; key: string; name: string; tally: Tally; eval: EvalEntry }

const tallyOf = (e: EvalEntry): Tally => ({
  pass: e.trials.filter((a) => a.outcome === 'pass').length,
  fail: e.trials.filter((a) => a.outcome === 'fail' && !isUngatedMiss(e, a)).length,
  missed: e.trials.filter((a) => isUngatedMiss(e, a)).length,
  infra: e.trials.filter((a) => a.outcome === 'infra_error').length,
  skipped: e.trials.filter((a) => a.outcome === 'skipped').length,
})

const addTally = (a: Tally, b: Tally): Tally => ({
  pass: a.pass + b.pass,
  fail: a.fail + b.fail,
  missed: a.missed + b.missed,
  infra: a.infra + b.infra,
  skipped: a.skipped + b.skipped,
})

const ZERO: Tally = { pass: 0, fail: 0, missed: 0, infra: 0, skipped: 0 }

/** Files, then groups, then evals, each with trial counts; failing branches sort first. */
export function evalTree(record: Pick<RunRecord, 'evals'>): TreeNode[] {
  const root: Extract<TreeNode, { kind: 'group' }> = {
    kind: 'group',
    key: '',
    name: '',
    tally: ZERO,
    children: [],
  }
  for (const e of record.evals) {
    const trail =
      e.group.length || e.id.includes(' › ') ? [e.file, ...e.group] : e.id.split('/').slice(0, -1)
    let node = root
    for (const [i, name] of trail.entries()) {
      const key = trail.slice(0, i + 1).join(' › ')
      let child = node.children.find(
        (c): c is Extract<TreeNode, { kind: 'group' }> => c.kind === 'group' && c.key === key,
      )
      if (!child) {
        child = { kind: 'group', key, name, tally: ZERO, children: [] }
        node.children.push(child)
      }
      node = child
    }
    node.children.push({ kind: 'eval', key: e.id, name: e.name, tally: tallyOf(e), eval: e })
  }
  const finish = (n: TreeNode): TreeNode => {
    if (n.kind === 'eval') return n
    const children = n.children.map(finish)
    children.sort((a, b) => rank(a.tally) - rank(b.tally))
    return { ...n, children, tally: children.reduce((t, c) => addTally(t, c.tally), ZERO) }
  }
  return (finish(root) as Extract<TreeNode, { kind: 'group' }>).children
}

const rank = (t: Tally) => (t.fail ? 0 : t.infra ? 1 : t.pass ? 2 : 3)

export type CellRow = {
  key: string
  harness: string
  environment: string
  sandbox: string
  role: CellRecord['role']
  /** Whether the cell's failures fail the eval: its gate isn't `'none'`. */
  gated: boolean
  gate: CellRecord['gate']
  overrides: string[]
  /** The reasoning effort the harness factory asked for; null when it left it unset. */
  reasoningEffort: string | null
  /** Trials the cell planned; with `bestOf`, the most it runs. */
  trialCount: number
  pass: number
  fail: number
  infraError: number
  skipped: number
  /** pass@1: passes over passes and fails. */
  passAt1: number | null
  outcome: Outcome
  /** A variant's lift over its baseline, in whole points (from the record), else null. */
  lift: number | null
  /** Its 95% interval in whole points, and whether that spans 0. */
  liftInterval: { lo: number; hi: number; withinNoise: boolean } | null
  /** The interval's lower bound is below the compare's `minLift`. */
  belowMinLift: boolean
  /** Median tool calls, agent time and tokens over the cell's counted trials. */
  effort: CellEffort | null
  /** A variant's effort against its baseline, with the rank test's verdict. */
  effortVsBaseline: EffortContrast | null
  /** Per-key judge pass/counted over this cell's counted trials. */
  judgeRates: JudgeKeyRate[]
  /** Sum of counted trials' tokens; null when none reported. */
  usage: TokenUsage | null
  trials: TrialRecord[]
}

/** One row per cell: baselines and variants, with each variant's recorded lift. */
export function cellRows(e: EvalEntry): CellRow[] {
  return e.cells.map((cell) => ({
    key: cell.key,
    harness: cell.harness,
    environment: cell.environment,
    sandbox: cell.sandbox,
    role: cell.role,
    gated: cell.gate !== 'none',
    gate: cell.gate,
    overrides: cell.overrides,
    reasoningEffort: cell.effort ?? null,
    trialCount: cell.trials,
    pass: cell.pass,
    fail: cell.fail,
    infraError: cell.infraError,
    skipped: cell.skipped,
    passAt1: cell.passRate,
    outcome: cell.outcome,
    lift: cell.lift ? Math.round(cell.lift.points * 100) : null,
    liftInterval: cell.lift
      ? {
          lo: Math.round(cell.lift.interval.lo * 100),
          hi: Math.round(cell.lift.interval.hi * 100),
          withinNoise: cell.lift.withinNoise,
        }
      : null,
    belowMinLift: cell.lift?.minLift !== undefined && cell.lift.interval.lo < cell.lift.minLift,
    effort: cellEffort(e, cell.key),
    effortVsBaseline: cellContrast(e, cell.key),
    judgeRates: cellJudgeRates(e, cell.key),
    usage: cellUsage(e, cell.key),
    trials: e.trials.filter((a) => a.cell === cell.key),
  }))
}

/** One side's wins over the decided votes it was in; `rate` is null when none decided. */
export type AnswerRate = { name: string; wins: number; n: number; rate: number | null }

export type AnswerRow = {
  question: string
  /** The model that answered: as served, when the provider said, else as configured. */
  model: string
  votes: number
  ties: number
  /** Environments against each other on one harness, then harnesses against each other on one environment. */
  within: AnswerRate[]
  across: AnswerRate[]
  /** Why some or all of its votes are missing: the model call failed. */
  error: string | null
  /** No votes and no error: no pair had both sides pass their checks. */
  noPairs: boolean
  /** Distinct vote reasons, in vote order, at most three. */
  reasons: string[]
  /** `questions/<n>.json` under the run's directory: what the model was sent; null when not kept. */
  input: string | null
}

/** One row per pairwise question, with each cut's win rates in the record's order. */
export function answerRows(e: Pick<EvalEntry, 'answers'>): AnswerRow[] {
  return (e.answers ?? []).map((a) => {
    const rates = (cut: string): AnswerRate[] =>
      a.rates
        .filter((r) => r.cut === cut)
        .map((r) => ({ name: r.name, wins: r.wins, n: r.n, rate: r.n ? r.wins / r.n : null }))
    return {
      question: a.question,
      model: a.resolvedModel ?? a.model,
      votes: a.votes.length,
      ties: a.votes.filter((v) => v.winner === 'tie').length,
      within: rates('within'),
      across: rates('across'),
      error: a.error ?? null,
      noPairs: a.votes.length === 0 && a.error === undefined,
      reasons: sampleReasons(a.votes),
      input: a.input?.path ?? null,
    }
  })
}

/** One trial's answer to a question asked of it on its own. */
export type TrialAnswerItem = {
  /** The trial's id, `<cell key>#<n>`. */
  trial: string
  outcome: Outcome
  choice: string | null
  text: string
  error: string | null
  /** `questions/<n>.json` in the trial's directory: what the model was sent; null when not kept. */
  input: string | null
}

export type TrialAnswerRow = {
  question: string
  /** The model that answered: as served, when the provider said, else as configured. */
  model: string
  /** How many trials picked each choice, in the question's order; null on a free-text question. */
  choices: Array<{ choice: string; n: number }> | null
  answers: TrialAnswerItem[]
}

/** One row per question asked of each trial on its own, in first-asked order. */
export function trialAnswerRows(e: Pick<EvalEntry, 'trials'>): TrialAnswerRow[] {
  const rows = new Map<string, TrialAnswerRow>()
  for (const a of e.trials) {
    for (const q of a.answers ?? []) {
      const row = rows.get(q.question) ?? {
        question: q.question,
        model: q.resolvedModel ?? q.model,
        choices: q.choices ? q.choices.map((choice) => ({ choice, n: 0 })) : null,
        answers: [],
      }
      rows.set(q.question, row)
      const picked = q.error === undefined && row.choices?.find((c) => c.choice === q.choice)
      if (picked) picked.n++
      row.answers.push({
        trial: a.id,
        outcome: a.outcome,
        choice: q.choice ?? null,
        text: q.text,
        error: q.error ?? null,
        input: q.input?.path ?? null,
      })
    }
  }
  return [...rows.values()]
}

/** Whether an eval needs the cells table: several cells, or several trials of one. */
export const isMatrix = (e: Pick<EvalEntry, 'cells'>) =>
  e.cells.length > 1 || e.cells.some((c) => c.trials > 1)

// ── Eval history ─────────────────────────────────────────────────────────────────────────────

export type EvalHistoryPoint = {
  run: HistoryEntry
  outcome: Outcome
  /** pass@1 over the gated cells' trials. */
  passAt1: number | null
  cells: HistoryCell[]
  /** A cell's fingerprint differs from the last run that had that cell. */
  changed: boolean
}

/** One eval across runs, oldest first. */
export function evalHistory(entries: HistoryEntry[], slug: string): EvalHistoryPoint[] {
  const oldest = [...entries].sort((a, b) => (a.runId < b.runId ? -1 : 1))
  const points: EvalHistoryPoint[] = []
  const seen = new Map<string, string>()
  for (const run of oldest) {
    const e = run.evals.find((x) => x.slug === slug)
    if (!e) continue
    points.push({
      run,
      outcome: e.outcome,
      passAt1: e.passRate,
      cells: e.cells,
      changed: cellsChanged(seen, e.id, e.cells),
    })
  }
  return points
}

// ── Compare ──────────────────────────────────────────────────────────────────────────────────

export type CompareViewRow = {
  id: string
  slug: string | null
  status: CompareStatus
  base: Outcome | null
  head: Outcome | null
  basePassAt1: number | null
  headPassAt1: number | null
  /** See `CompareRow`: then pass@1 is over the cells both runs have too. */
  cells?: CompareRow['cells']
  changes?: string[]
  gate?: CompareRow['gate']
  /** Mean judge score per run; null without judgments or without the record. */
  baseScore: number | null
  headScore: number | null
  /** Cells in both runs, with lift and effort on each side. */
  perCell: CompareCell[]
  /** See `CompareRow`: an eval with `cases`, each case's row, and its gates over the cases. */
  cases?: CompareRow['cases']
  caseScope?: CompareRow['caseScope']
  lifts?: CompareRow['lifts']
  rates?: CompareRow['rates']
}

const meanScore = (e: EvalEntry | undefined) => {
  const scores = e?.trials.flatMap((a) => a.judgements.map((j) => j.score)) ?? []
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
}

export const COMPARE_ORDER: CompareStatus[] = [
  'regressed',
  'fixed',
  'drift',
  'gate',
  'infra',
  'added',
  'removed',
  'same',
]

/**
 * Whether some of an eval's cells aren't gated (`gate: 'none'`, e.g. a compare's baselines). Its pass@1 then covers fewer trials than its pass count, so
 * the eval line labels it `gated`: `2/4 · pass@1 100% gated`.
 */
export const hasUngatedCells = (cells: readonly Pick<HistoryCell, 'gate'>[]) =>
  cells.some((c) => c.gate === 'none')

/**
 * An expected miss: a failed trial in an ungated cell (a baseline, by default). It's reported
 * apart from failures, since it fails neither its eval nor the run.
 */
export const isUngatedMiss = (
  e: { cells: readonly Pick<HistoryCell, 'key' | 'gate'>[] },
  a: Pick<TrialRecord, 'cell' | 'outcome' | 'error'>,
) =>
  a.outcome === 'fail' &&
  a.error?.kind !== 'aborted' &&
  e.cells.find((c) => c.key === a.cell)?.gate === 'none'

/**
 * The outcome an eval's mark shows. A pass needs a counted (passed or failed) trial and no infra
 * error: a gate that lets those through, such as `gate: 'none'`, still shows `!`, not `✓`.
 */
export function evalMarkOutcome(e: Pick<EvalEntry, 'outcome' | 'trials'>): Outcome {
  if (e.outcome !== 'pass') return e.outcome
  const ran = e.trials.filter((a) => a.outcome !== 'skipped')
  const infra = ran.some((a) => a.outcome === 'infra_error')
  return infra || (ran.length > 0 && !ran.some((a) => a.outcome === 'pass' || a.outcome === 'fail'))
    ? 'infra_error'
    : 'pass'
}

/** pass@1 in the gated cells, as an eval's `passRate` counts it. */
function gatedPassAt1(cells: HistoryCell[]): number | null {
  const gated = cells.filter((c) => c.gate !== 'none')
  const pass = gated.reduce((n, c) => n + c.pass, 0)
  const counted = pass + gated.reduce((n, c) => n + c.fail, 0)
  return counted ? pass / counted : null
}

/** `reeval compare`'s classification, plus pass@1 and judge-score deltas from the records. */
export function compareView(
  base: HistoryEntry,
  head: HistoryEntry,
  records: { base?: RunRecord; head?: RunRecord } = {},
) {
  const rows: CompareViewRow[] = compare(base, head).map((row) => {
    const evalOf = (run: HistoryEntry) => run.evals.find((e) => e.id === row.id)
    const b = evalOf(base)
    const h = evalOf(head)
    const baseKeys = new Set(b?.cells.map((c) => c.key))
    const shared =
      row.cells && new Set(h?.cells.filter((c) => baseKeys.has(c.key)).map((c) => c.key))
    const passAt1 = (e: typeof b) => {
      if (!e) return null
      return shared ? gatedPassAt1(e.cells.filter((c) => shared.has(c.key))) : e.passRate
    }
    return {
      ...row,
      slug: h?.slug ?? b?.slug ?? null,
      basePassAt1: passAt1(b),
      headPassAt1: passAt1(h),
      baseScore: b ? meanScore(records.base?.evals.find((e) => e.id === row.id)) : null,
      headScore: h ? meanScore(records.head?.evals.find((e) => e.id === row.id)) : null,
      perCell: row.perCell ?? [],
    }
  })
  rows.sort((a, b) => COMPARE_ORDER.indexOf(a.status) - COMPARE_ORDER.indexOf(b.status))
  const counts = Object.fromEntries(
    COMPARE_ORDER.map((s) => [s, rows.filter((r) => r.status === s).length]),
  ) as Record<CompareStatus, number>
  return { rows, counts, changes: stackChanges(base, head) }
}

// ── Trajectory ───────────────────────────────────────────────────────────────────────────────

export type TrajectoryLine =
  | ({ turn: number } & TrajectoryEvent)
  | { turn: number; ts: string; atMs: number; type: 'prompt'; text: string }
  | {
      turn: number
      ts: string
      atMs: number
      type: 'turn-end'
      status: TurnStatus
      durationMs: number
    }
  /** A `c.decide()` call, before the prompt of the turn it came before (`turn`). */
  | { turn: number; ts: string; atMs: number; type: 'decision'; decision: DecisionRecord }

export type TrajectoryItem =
  | { kind: 'turn'; turn: number; prompt: string; ts: string }
  | { kind: 'event'; turn: number; event: TrajectoryLine }
  | { kind: 'turn-end'; turn: number; status: TurnStatus; durationMs: number }

/** Parses `trajectory.jsonl`, skipping lines that aren't JSON (a truncated tail, say). */
export function parseTrajectory(text: string): TrajectoryLine[] {
  return text.split('\n').flatMap((line) => parseTrajectoryLine(line) ?? [])
}

/**
 * `trajectory.jsonl`'s lines in file order, each as `parseTrajectoryLine` reads it, so line `n`
 * (from 1) is at index `n - 1`.
 */
export function trajectoryByLine(text: string): Array<TrajectoryLine | null> {
  return text.split('\n').map((line) => parseTrajectoryLine(line))
}

/** One line of a trajectory, or null when it's blank, isn't JSON or has no `type`. */
export function parseTrajectoryLine(line: string): TrajectoryLine | null {
  if (!line.trim()) return null
  try {
    const value = JSON.parse(line) as TrajectoryLine
    return value && typeof value.type === 'string' ? readableTrajectoryLine(value) : null
  } catch {
    return null
  }
}

export function trajectoryItems(lines: TrajectoryLine[]): TrajectoryItem[] {
  return lines.map((line) => {
    if (line.type === 'prompt') {
      return { kind: 'turn', turn: line.turn, prompt: line.text, ts: line.ts }
    }
    if (line.type === 'turn-end') {
      return { kind: 'turn-end', turn: line.turn, status: line.status, durationMs: line.durationMs }
    }
    return { kind: 'event', turn: line.turn, event: line }
  })
}

// ── Lookups ──────────────────────────────────────────────────────────────────────────────────

export const findEval = (record: Pick<RunRecord, 'evals'>, slug: string) =>
  record.evals.find((e) => e.slug === slug)

export const findTrial = (e: EvalEntry, trialId: string) => e.trials.find((a) => a.id === trialId)

/** The trial to open by default: the first failure, else the first trial. */
export const defaultTrial = (e: EvalEntry) =>
  e.trials.find((a) => a.outcome === 'fail' || a.outcome === 'infra_error') ?? e.trials[0]
