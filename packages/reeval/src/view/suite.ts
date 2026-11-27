// The facts of one run as the output layouts read them: files, evals (or a family's cases),
// cells and checks, with each variant's effect. Recomputed from the record on every read and
// never persisted, so a run recorded by any reeval renders. No model is involved: every field
// here is the result, and the exit code reads only these.

import { unfoldCases } from '../history/cases.ts'
import type {
  CellRecord,
  CheckTally,
  EvalEntry,
  FamilyLift,
  FamilyRecord,
  FamilyVerdict,
  RunRecord,
  TrialRecord,
  UpstreamCount,
} from '../history/types.ts'
import { COMPARE_TRIALS } from '../stats.ts'
import { blocks, DEFAULT_TARGET } from '../target.ts'
import type { ErrorKind, Outcome, RecordedTarget, TrialFailure } from '../types.ts'
import { cellEffort } from './effort.ts'
import { caseLabel } from './family.ts'
import { targetCells } from './gate.ts'
import { checksByLabel, checkTries, labeledJudgments } from './judgments.ts'
import { cellMeasures, familyMeasures, type Measure } from './measures.ts'
import { notRunYet, runOutcome, trialAnswerRows } from './model.ts'
import { type ObservedTally, observedTallies } from './observations.ts'

/**
 * A variant against its baseline: the direction of their observed pass rates, at any number of
 * runs. Whether it holds is the interval's to say (`CellResult.interval`), and the
 * `too-few-trials` remark says how many runs would settle it.
 */
export type Effect = 'better' | 'worse' | 'same'

/**
 * What an eval's cells compare: `change` when it has variants (or several environments),
 * `harness` when it has several agents, `both`, or `none`.
 */
export type Across = 'none' | 'change' | 'harness' | 'both'

export { COMPARE_TRIALS }

/**
 * One finished run's facts. Every node has a `path`, a stable id that remarks cite it by.
 *
 * A path is `/`-separated segments, each with `%`, `/` and `+` percent-encoded:
 *
 * - `<eval>`: the eval's id (`evals/a.eval.ts › group › name`) or a family's
 *   (`evals/a.eval.ts › fixes $id`);
 * - `<eval>/<case>`: a family case, by its label (`GH-101` for `fixes GH-101`);
 * - `<eval>[/<case>]/<harness>+<environment>+<sandbox>`: a cell;
 * - `<cell>/checks/<label>`: a check, by its assertion label;
 * - `<eval>/<harness>+<environment>+<sandbox>`: on a family, a variant's pooled effect.
 *
 * A case segment never has a raw `+` and a cell segment always has two, so the two can't be
 * confused. Ids, labels and cell keys are what runs are matched on, so a path names the same
 * fact in every run that has it.
 */
export type SuiteResult = {
  runId: string
  status: RunRecord['status']
  /**
   * The run's outcome, which `reeval run`'s exit code is read from: `fail` on any error outside
   * a trial, and `skipped` on an interrupted run. `reeval run --json` gives a resume that its
   * filters left `interrupted` the outcome of the trials it ran, as its exit code.
   */
  outcome: Outcome
  /**
   * Errors outside any trial: an eval file that didn't load, a rejection or throw no trial
   * awaited, a worker that died. Any one fails the run.
   */
  errors: string[]
  /**
   * Each eval against its target, an eval with `cases` once. `errors` counts the run's `errors`.
   */
  tally: SuiteTally
  /** Sorted by path. */
  files: ResultFile[]
}

/**
 * `onTarget` and `below` count the evals whose target blocks, `reportOnly` those whose target
 * doesn't; an eval that didn't count a trial is an infra error, canceled or skipped instead.
 */
export type SuiteTally = {
  errors: number
  evals: number
  onTarget: number
  below: number
  reportOnly: number
  infraError: number
  canceled: number
  skipped: number
}

/**
 * An eval's or a family case's outcome: the record's, except `canceled` where its only failed
 * gated trials are ones the run's interrupt canceled, since the agent didn't fail those.
 */
export type ResultOutcome = Outcome | 'canceled'

export type ResultFile = {
  path: string
  evals: EvalResult[]
}

export type EvalResult = {
  path: string
  /** The eval's id, or the family's. */
  id: string
  group: string[]
  /** The eval's name; on a family, its template. */
  name: string
  /** A family's name template (`fixes $id`); null on a single eval. */
  template: string | null
  /** Source order in the file. */
  order: number
  across: Across
  /** An eval with `cases`: `cases` is set and `cells` is null. */
  family: boolean
  /** A placeholder (`evaluate.todo`) that never ran. */
  todo: boolean
  /**
   * Hasn't run yet: skipped, but not a todo or declared skipped, in a run that isn't complete. On
   * a family, every case.
   */
  notRun: boolean
  /**
   * On a family: `fail` when its pooled gate failed, or a case it doesn't gate on its rate did.
   */
  outcome: ResultOutcome
  cells: CellResult[] | null
  cases: CaseResult[] | null
  /** A family's variants against their baseline, pooled over the cases; null on a single eval. */
  pooled: PooledEnvironment[] | null
  /** A family's `{ passRate }` cells, each gated on its rate over the cases; null on a single eval. */
  rates: PooledRate[] | null
  /**
   * Its questions' answers: the pairwise ones, then those asked of each trial. On a family,
   * each question asked of any case, in first-asked order, summed over the cases that answered it.
   */
  questions: Array<QuestionResult | TrialQuestionResult>
  /** Each name its trials observed with `c.observe`, tallied per cell; with cases, over every case. */
  observations: ObservedTally[]
  /** What decides `outcome`. */
  target: RecordedTarget
  /** Whether a miss of its target fails the run. */
  blocking: boolean
  /**
   * The mean score over its target's cells' counted trials (with cases, the mean of the cases');
   * null when none counted.
   */
  meanScore: number | null
  /** Its target's cells' trials (the variants on a compare, else every cell), case by case. */
  scored: ScoredTrial[]
}

/** One trial of an eval's target cells, with what cost it points. */
export type ScoredTrial = {
  /** Its case's key; null on an eval without `cases`. */
  case: string | null
  cell: string
  n: number
  outcome: Outcome
  /** In [0, 1]; null when it didn't count (an infra error, a cancel, skipped). */
  score: number | null
  /** Its scored graders that scored under 1 or errored, in the eval's order. */
  lost: LostGrade[]
  /** The checks it failed, each with its message and where its `expect` is. */
  failedChecks: Array<{ label: string; message: string | null; at: string | null }>
  /** What the task threw. */
  failure: TrialFailure | null
  /**
   * The error it ended on, when nothing else says why: a timeout, a cancel, an infra error, or a
   * failure no check recorded. Null when the task threw (`failure`) or a check failed.
   */
  error: { kind: ErrorKind; message: string } | null
}

export type LostGrade = {
  grader: string
  kind: 'code' | 'judge' | 'builtin'
  /** In [0, 1]; 0 when it errored. */
  score: number
  required: boolean
  error: string | null
}

/** A pairwise question: each side's wins over the pairs the model decided. Never gates. */
export type QuestionResult = {
  kind: 'pairs'
  question: string
  /** Pairs voted, each counted once per order it was asked in. */
  votes: number
  rates: Array<{ cut: 'within' | 'across'; name: string; wins: number; n: number }>
  /** Why some or all of its votes are missing: the model call failed. */
  error: string | null
}

/** A question asked of each trial on its own: what each one answered. Never gates. */
export type TrialQuestionResult = {
  kind: 'trials'
  question: string
  /** Trials it was asked of, failed calls included. */
  asked: number
  /** How many trials picked each choice, in the question's order; null on a free-text question. */
  choices: Array<{ choice: string; n: number }> | null
  /** Each trial's answer, in trial order; failed calls left out. */
  answers: Array<{ trial: string; choice: string | null; text: string }>
  /** Calls that failed, and the first one's error. */
  failed: number
  error: string | null
}

export type CaseResult = {
  path: string
  /** The case's own eval id. */
  id: string
  /** Its name less the template's literal text: `GH-101` for `fixes GH-101`. */
  label: string
  name: string
  /** Its place in the case list. */
  order: number
  /** What the case did; when its family's rate gates it, the family's outcome is the verdict. */
  outcome: ResultOutcome
  /** Hasn't run yet, as `EvalResult.notRun`. */
  notRun: boolean
  cells: CellResult[]
}

export type CellResult = {
  path: string
  key: string
  harness: string
  /** `-` when no environment is set. */
  environment: string
  sandbox: string
  /** The variant's name; null on a baseline. */
  variant: string | null
  /** The baseline of an eval that has variants: the environment the variants are measured against. */
  baseline: boolean
  /** On a variant, its baseline cell's key; else null. */
  vs: string | null
  /** The cell's place in the eval's cells. */
  order: number
  /** Its failures fail the eval (its gate isn't `'none'`). */
  gated: boolean
  outcome: Outcome
  /** Every trial: `passed + failed + infraError + skipped`. */
  trials: number
  passed: number
  failed: number
  /** Infrastructure errors, which are neither passes nor fails. */
  infraError: number
  skipped: number
  /** Set by `trials: { bestOf }`: the cell stopped once a majority of this many trials agreed. */
  bestOf?: number
  /** Of `skipped`, the trials a best-of cell's majority left unrun. */
  notNeeded?: number
  fingerprint: string
  /** The skill sources and files the cell's environment placed, as written. */
  context: string[]
  /**
   * Every check the eval's trials recorded (on a family, any case's). A cell with no counted
   * trial (every one an infra error or skipped) lists each as `not run`.
   */
  checks: CheckResult[]
  /** On a variant, the direction of its pass rate against its baseline's; null on a baseline or with nothing counted on a side. */
  effect: Effect | null
  /** The stored 95% interval on the variant's difference from its baseline. Not for display. */
  interval: Interval | null
  /** On a variant, the compare's `minLift`, a fraction like the interval; null without one. */
  minLift: number | null
  /** Medians over the counted trials; null below `COMPARE_TRIALS` of them. */
  effort: EffortCounters | null
  /** On a variant, every measure against its baseline (`cellMeasures`); null on a baseline. */
  measures: Measure[] | null
  /** Why trials failed or errored where no check says: a timeout, an infra error, a throw. */
  errors: CellError[]
  /**
   * Where each failed trial's final snapshot is, from the project's root
   * (`.reeval/runs/<run>/…/snapshots/final`); absent when none has one.
   */
  snapshots?: string[]
  /** Web searches and fetches per counted trial; null where the harness can't report them. */
  searches: Array<number | null>
  fetches: Array<number | null>
  /**
   * The upstream providers a gateway (OpenRouter) said served the cell's agent calls, with how
   * many, summed over its trials in first-seen order; absent when it named none.
   */
  upstreams?: UpstreamCount[]
  /** The same for the cell's judge calls; absent when the gateway named none. */
  judgeUpstreams?: UpstreamCount[]
  /**
   * Each `c.capture()` in its trials whose page had page errors, with the `.capture.json` that
   * lists them (`.reeval/runs/<run>/…/artifacts/<name>.capture.json`); absent when none had any.
   */
  pageErrors?: Array<{ capture: string; errors: number; file: string }>
  /**
   * Why a trial's final workspace wasn't kept (over its size cap, or an error), or which files
   * it was kept without because the secret scan found something in them; absent when every
   * trial kept it whole or none kept one.
   */
  workspaceNotes?: string[]
}

/** Summed per provider, in first-seen order. */
function tallyUpstreams(counts: Iterable<UpstreamCount>): UpstreamCount[] {
  const by = new Map<string, number>()
  for (const { provider, calls } of counts) by.set(provider, (by.get(provider) ?? 0) + calls)
  return [...by].map(([provider, calls]) => ({ provider, calls }))
}

/** A cell's trials the run's interrupt canceled: recorded as fails, but not the agent's. */
export const canceledOf = (cell: CellResult) =>
  cell.errors.filter((err) => err.kind === 'aborted').reduce((n, err) => n + err.trials, 0)

/** A cell's counted tries: its passes and fails, less the ones the interrupt canceled. */
export const countedOf = (cell: CellResult) =>
  Math.max(0, cell.passed + cell.failed - canceledOf(cell))

export type CheckResult = {
  path: string
  label: string
  /** First-seen order across the eval's trials. */
  order: number
  outcome: CheckOutcome
  /**
   * On a variant, this check against the baseline's (null when either side never answered it);
   * null on a baseline or without one.
   */
  effect: Effect | null
  /** Set when the check is a judge verdict. */
  judge: JudgeResult | null
  /**
   * A `toSucceed` check whose `c.exec` had `retries` and needed them: on one counted trial how
   * it ended (`passed on try 2 of 3`, `failed all 3 tries`), on several how many retried. Unset
   * when none did.
   */
  retried?: string
}

/**
 * `not run`: no counted trial reached the check, because an `expect.require` before it failed or
 * none counted. That is not a failure, and is never `0 of N`. `ran`: counts over the counted trials that
 * reached it (`errored` ones couldn't answer), with `notRun` for those that didn't, and the
 * first failure's message and `path:line`.
 */
export type CheckOutcome =
  | { status: 'not run' }
  | {
      status: 'ran'
      passed: number
      failed: number
      errored: number
      notRun: number
      assertion: string | null
      at: string | null
    }

/**
 * One distinct error over a cell's trials: its kind (`turn` for a turn the harness ended with
 * an error), its message's first line, and how often.
 */
export type CellError = {
  kind: ErrorKind | 'turn'
  message: string
  trials: number
  /** What the task threw, for a throw: its first trial's, the message being its reason. */
  failure?: Omit<TrialFailure, 'kind' | 'reason'>
}

export type JudgeResult = {
  question: string
  threshold: number
  /** One per counted trial that judged it. */
  scores: number[]
}

type Interval = { low: number; high: number }

/** A null counter is one the harness didn't record; a recorded zero stays zero. */
export type EffortCounters = {
  tools: number | null
  /** Median model calls; omitted when no trial counted them (`activity.llmCalls`). */
  llmCalls?: number
  agentMs: number | null
  tokens: number | null
  /** Median time waiting on background jobs; omitted when no trial recorded where its time went. */
  waitingMs?: number
}

export type PooledEnvironment = {
  path: string
  /** The variant cell's key, the same in every case. */
  key: string
  vs: string
  effect: Effect
  /** Cases with counted trials on both sides. */
  pairs: number
  interval: Interval
  /** The pooled lift's verdict: `insufficient` below `PAIRED_MIN` discordant pairs or cases. */
  verdict: FamilyVerdict
  /** The compare's `minLift`, a fraction like the interval, which gates its low end; null without one. */
  minLift: number | null
  outcome: 'pass' | 'fail'
  /** Every measure over the cases (`familyMeasures`). */
  measures: Measure[]
}

/** A cell's pass@1 over a family's cases, which its `{ passRate }` gate gates. */
export type PooledRate = {
  /** The cell's key, the same in every case. */
  key: string
  /** The mean of the cases' pass@1. */
  rate: number
  passRate: number
  outcome: 'pass' | 'fail'
}

type Side = { pass: number; counted: number }

/** The direction of `variant`'s pass rate against `baseline`'s; null when a side counted none. */
export function effectOf(variant: Side, baseline: Side): Effect | null {
  if (variant.counted === 0 || baseline.counted === 0) return null
  const v = variant.pass * baseline.counted
  const c = baseline.pass * variant.counted
  return v > c ? 'better' : v < c ? 'worse' : 'same'
}

/** A check's passes over the trials that answered it; `notRun` and `error` aren't counted. */
const checkSide = (t: CheckTally): Side => ({ pass: t.pass, counted: t.pass + t.fail })

/** The check's direction on the variant against the baseline; null when a side never answered it. */
export const checkEffect = (variant: CheckTally, baseline: CheckTally): Effect | null =>
  effectOf(checkSide(variant), checkSide(baseline))

/** One path segment: `%`, `/` and `+` percent-encoded, so segments split back unambiguously. */
export const factSegment = (s: string) =>
  s.replace(/%/g, '%25').replace(/\//g, '%2F').replace(/\+/g, '%2B')

const cellSegment = (c: Pick<CellRecord, 'harness' | 'environment' | 'sandbox'>) =>
  [c.harness, c.environment, c.sandbox].map(factSegment).join('+')

const counted = (a: Pick<TrialRecord, 'outcome'>) => a.outcome === 'pass' || a.outcome === 'fail'

export function evalAcross(
  cells: readonly Pick<CellRecord, 'harness' | 'environment' | 'role'>[],
): Across {
  const harness = new Set(cells.map((c) => c.harness)).size > 1
  const change =
    cells.some((c) => c.role === 'variant') || new Set(cells.map((c) => c.environment)).size > 1
  return harness && change ? 'both' : harness ? 'harness' : change ? 'change' : 'none'
}

/** The skill sources and files an environment placed; `local:` sources as their path. */
function contextOf(record: RunRecord, cell: CellRecord): string[] {
  const envs = record.environments.filter((e) => e.digest === cell.environmentDigest)
  const env = envs.find((e) => e.name === cell.environment) ?? envs[0]
  if (!env) return []
  return [
    ...env.skills.map((s) => s.source.replace(/^local:/, '')),
    ...env.files.map((f) => f.path),
  ]
}

/** The baseline a variant is measured against: its lift's, else the baseline on its harness and sandbox. */
function baselineOf(e: EvalEntry, cell: CellRecord): CellRecord | undefined {
  if (cell.role !== 'variant') return undefined
  const vs = cell.lift?.vs
  return vs
    ? e.cells.find((c) => c.key === vs)
    : e.cells.find(
        (c) => c.role === 'baseline' && c.harness === cell.harness && c.sandbox === cell.sandbox,
      )
}

/** Every check label the trials recorded, in first-seen order: the eval's declared checks. */
function declaredChecks(entries: readonly EvalEntry[]): string[] {
  return [
    ...new Set(
      entries.flatMap((e) => e.trials.flatMap((a) => (a.assertions ?? []).map((x) => x.label))),
    ),
  ]
}

function checksOf(
  e: EvalEntry,
  cell: CellRecord,
  baseline: CellRecord | undefined,
  base: string,
  declared: readonly string[],
): CheckResult[] {
  const trials = e.trials.filter((a) => a.cell === cell.key && counted(a))
  // The record tallies checks over counted trials only, so a cell with none has no tallies.
  const tallies =
    cell.checks ??
    declared.map((label) => ({
      label,
      pass: 0,
      fail: 0,
      error: 0,
      notRun: 0,
      notApplicable: 0,
    }))
  return tallies.map((k, order) => {
    const ran = k.pass + k.fail + k.error
    const answered = trials
      .flatMap((a) => a.assertions ?? [])
      .filter((x) => x.label === k.label && x.message)
    const shown =
      answered.find((x) => x.status === 'fail') ?? answered.find((x) => x.status === 'error')
    const assertion = shown?.message ?? null
    // A baseline with no counted trial records no checks: it never ran this one.
    const baselineCheck = baseline
      ? (baseline.checks?.find((x) => x.label === k.label) ?? {
          pass: 0,
          fail: 0,
          error: 0,
          notRun: 0,
          notApplicable: 0,
        })
      : undefined
    const judged = trials.flatMap((a) =>
      labeledJudgments(a)
        .filter((j) => j.check === k.label)
        .map((j) => j.judgment),
    )
    const first = judged[0]
    const notes = trials.flatMap((a) => {
      const check = checksByLabel(a).get(k.label)
      const note = check && checkTries(check)
      return note ? [note] : []
    })
    const retried =
      trials.length === 1
        ? notes[0]
        : notes.length
          ? `retried in ${notes.length} of ${trials.length} trials`
          : undefined
    return {
      path: `${base}/checks/${factSegment(k.label)}`,
      label: k.label,
      order,
      outcome:
        ran === 0
          ? { status: 'not run' }
          : {
              status: 'ran',
              passed: k.pass,
              failed: k.fail,
              errored: k.error,
              notRun: k.notRun,
              assertion,
              at: shown?.at ?? null,
            },
      effect: baselineCheck ? checkEffect(k, baselineCheck) : null,
      judge: first
        ? {
            question: first.question,
            threshold: first.threshold,
            scores: judged.map((j) => j.score),
          }
        : null,
      ...(retried ? { retried } : {}),
    }
  })
}

const informative = (line: string) => /[\p{L}\p{N}]/u.test(line)

/**
 * An error's one line: its first line with any letter or digit in it, joined with the next one
 * when it ends with `:`, since `Docker failed:` alone says nothing. A log line's `| ` is dropped.
 */
export function messageLine(text: string): string {
  const [first = '', next] = text
    .split('\n')
    .map((l) => l.trim())
    .filter(informative)
  return first.endsWith(':') && next ? `${first} ${next.replace(/^[|>]\s*/, '')}` : first
}

/**
 * A task failure's one line: its reason, after its class for an error other than an `EvalError`,
 * a plain `Error` or an `AssertionError` (`TypeError: x is not a function`, `KeyError: 'missing'`).
 */
export const failureHeadline = (f: Pick<TrialFailure, 'reason' | 'name'>) =>
  f.name && !/^(Assertion)?Error$/.test(f.name) ? `${f.name}: ${f.reason}` : f.reason

/**
 * The errors of a cell's failed and infra-error trials that no failed check explains: every
 * timeout, infra error and abort, and an assertion or judge error on a trial whose recorded
 * checks all passed (a throw in the eval's body), plus each turn's error, which is often why.
 */
function errorsOf(e: EvalEntry, cell: CellRecord): CellError[] {
  const out: CellError[] = []
  const add = (kind: CellError['kind'], text: string, failure?: TrialFailure) => {
    const message = messageLine(text)
    const same = out.find((x) => x.kind === kind && x.message === message)
    if (same) same.trials++
    else if (failure) {
      const { kind: _, reason: __, ...rest } = failure
      out.push({ kind, message, trials: 1, failure: rest })
    } else out.push({ kind, message, trials: 1 })
  }
  for (const a of e.trials) {
    if (a.cell !== cell.key) continue
    if (a.outcome !== 'fail' && a.outcome !== 'infra_error') continue
    for (const turn of a.turns ?? []) if (turn.error) add('turn', turn.error)
    if (!a.error) continue
    const checked = a.error.kind === 'assertion' || a.error.kind === 'judge'
    if (checked && (a.assertions ?? []).some((x) => x.status !== 'pass')) continue
    if (a.failure) add(a.error.kind, failureHeadline(a.failure), a.failure)
    else add(a.error.kind, a.error.message)
  }
  return out
}

function questionsOf(e: EvalEntry): Array<QuestionResult | TrialQuestionResult> {
  const pairs = (e.answers ?? []).map(
    (a): QuestionResult => ({
      kind: 'pairs',
      question: a.question,
      votes: a.votes.length,
      rates: a.rates.map((r) => ({ cut: r.cut, name: r.name, wins: r.wins, n: r.n })),
      error: a.error ?? null,
    }),
  )
  const each = trialAnswerRows(e).map((row): TrialQuestionResult => {
    const failed = row.answers.filter((a) => a.error !== null)
    return {
      kind: 'trials',
      question: row.question,
      asked: row.answers.length,
      choices: row.choices,
      answers: row.answers
        .filter((a) => a.error === null)
        .map((a) => ({ trial: a.trial, choice: a.choice, text: a.text })),
      failed: failed.length,
      error: failed[0]?.error ?? null,
    }
  })
  return [...pairs, ...each]
}

function effortOf(e: EvalEntry, cell: CellRecord): EffortCounters | null {
  const effort = cellEffort(e, cell.key)
  if (!effort || effort.n < COMPARE_TRIALS) return null
  return {
    tools: effort.tools.median,
    ...(effort.llmCalls ? { llmCalls: effort.llmCalls.median } : {}),
    agentMs: effort.agentMs.median,
    tokens: effort.tokens?.median ?? null,
    ...(effort.split ? { waitingMs: effort.split.waitingMs } : {}),
  }
}

/** A variant's direction against its baseline; null without one, or with nothing counted on a side. */
function cellEffect(cell: CellRecord, baseline: CellRecord | undefined): Effect | null {
  if (cell.lift) return effectOf(cell.lift.variant, cell.lift.baseline)
  if (!baseline) return null
  return effectOf(
    { pass: cell.pass, counted: cell.pass + cell.fail },
    { pass: baseline.pass, counted: baseline.pass + baseline.fail },
  )
}

function cellsOf(
  record: RunRecord,
  e: EvalEntry,
  parent: string,
  declared: readonly string[],
): CellResult[] {
  const hasVariants = e.cells.some((c) => c.role === 'variant')
  return e.cells.map((cell, order) => {
    const path = `${parent}/${cellSegment(cell)}`
    const baseline = baselineOf(e, cell)
    const trials = e.trials.filter((a) => a.cell === cell.key && counted(a))
    const ran = e.trials.filter((a) => a.cell === cell.key)
    const upstreams = tallyUpstreams(ran.flatMap((a) => a.upstreams ?? []))
    const judgeUpstreams = tallyUpstreams(
      ran.flatMap((a) =>
        a.judgements.flatMap((j) => (j.upstream ? [{ provider: j.upstream, calls: 1 }] : [])),
      ),
    )
    const lift = cell.lift
    const interval = lift ? { low: lift.interval.lo, high: lift.interval.hi } : null
    const snapshots = ran.flatMap((a) => {
      const final = a.outcome === 'fail' || a.outcome === 'infra_error'
      const path = final && a.snapshots?.find((s) => s.name === 'final')?.path
      return path ? [`.reeval/runs/${record.runId}/${path}`] : []
    })
    const pageErrors = ran.flatMap((a) =>
      (a.files.artifacts ?? []).flatMap(({ name, capture }) =>
        capture?.pageErrors && capture.page
          ? [
              {
                capture: name,
                errors: capture.pageErrors,
                file: `.reeval/runs/${record.runId}/${capture.page.path}`,
              },
            ]
          : [],
      ),
    )
    const workspaceNotes = [
      ...new Set(
        ran.flatMap(({ workspace: w }) =>
          !w
            ? []
            : w.skipped
              ? [`workspace not kept: ${w.skipped.message}`]
              : w.dropped.length
                ? [
                    `workspace kept without ${w.dropped.length === 1 ? 'a file' : `${w.dropped.length} files`} the secret scan found something in: ${w.dropped.join(', ')}`,
                  ]
                : [],
        ),
      ),
    ]
    return {
      path,
      key: cell.key,
      harness: cell.harness,
      environment: cell.environment,
      sandbox: cell.sandbox,
      variant: cell.variant ?? null,
      baseline: hasVariants && cell.role === 'baseline',
      vs: baseline?.key ?? null,
      order,
      gated: cell.gate !== 'none',
      outcome: cell.outcome,
      trials: cell.trials,
      passed: cell.pass,
      failed: cell.fail,
      infraError: cell.infraError,
      skipped: cell.skipped,
      ...(cell.bestOf !== undefined
        ? {
            bestOf: cell.bestOf,
            notNeeded: ran.filter((a) => a.bestOf === 'skipped').length,
          }
        : {}),
      fingerprint: cell.fingerprint,
      context: contextOf(record, cell),
      checks: checksOf(e, cell, baseline, path, declared),
      effect: cell.role === 'variant' ? cellEffect(cell, baseline) : null,
      interval,
      minLift: lift?.minLift ?? null,
      effort: effortOf(e, cell),
      measures:
        cell.role === 'variant' && baseline ? cellMeasures(e, cell.key, baseline.key) : null,
      errors: errorsOf(e, cell),
      ...(snapshots.length ? { snapshots } : {}),
      searches: trials.map((a) => a.activity.webSearches),
      fetches: trials.map((a) => a.activity.webFetches),
      ...(upstreams.length ? { upstreams } : {}),
      ...(judgeUpstreams.length ? { judgeUpstreams } : {}),
      ...(pageErrors.length ? { pageErrors } : {}),
      ...(workspaceNotes.length ? { workspaceNotes } : {}),
    }
  })
}

function pooledEffect(lift: FamilyLift): Effect {
  if (lift.variantRate === lift.baselineRate) return 'same'
  return lift.variantRate > lift.baselineRate ? 'better' : 'worse'
}

/** Fail beats infra error, which beats canceled, which beats pass; skipped only when every one was. */
function worst(outcomes: ResultOutcome[]): ResultOutcome {
  if (outcomes.includes('fail')) return 'fail'
  if (outcomes.includes('infra_error')) return 'infra_error'
  if (outcomes.includes('canceled')) return 'canceled'
  if (outcomes.length && outcomes.every((o) => o === 'skipped')) return 'skipped'
  return 'pass'
}

/** The scored graders a trial lost points on: a score under 1, or an error. */
function lostOf(a: TrialRecord): LostGrade[] {
  return (a.grades ?? []).flatMap((g) =>
    g.weight > 0 && (g.error !== undefined || (g.score !== null && g.score < 1))
      ? [
          {
            grader: g.grader,
            kind: g.kind,
            score: g.score ?? 0,
            required: g.required,
            error: g.error ?? null,
          },
        ]
      : [],
  )
}

/** The eval's target and its target cells' trials, from its folded entry. */
function targetOf(
  e: EvalEntry | undefined,
): Pick<EvalResult, 'target' | 'blocking' | 'meanScore' | 'scored'> {
  const target = e?.target ?? DEFAULT_TARGET
  const cells = new Set(targetCells(e?.cells ?? []).map((c) => c.key))
  const order = new Map((e?.cases ?? []).map((k, i) => [k.key, i]))
  const scored = (e?.trials ?? [])
    .filter((a) => cells.has(a.cell) && a.outcome !== 'skipped')
    .map((a): ScoredTrial => {
      const failedChecks = (a.assertions ?? [])
        .filter((x) => x.status === 'fail' || x.status === 'error')
        .map((x) => ({
          label: x.label,
          message:
            x.message ?? (a.error?.message.startsWith(`${x.label}: `) ? a.error.message : null),
          at: x.at ?? null,
        }))
      const shown =
        a.error &&
        !a.failure &&
        (!failedChecks.length || (a.error.kind !== 'assertion' && a.error.kind !== 'judge'))
      return {
        case: a.case ?? null,
        cell: a.cell,
        n: a.n,
        outcome: a.outcome,
        score:
          counted(a) && a.error?.kind !== 'aborted'
            ? (a.score ?? (a.outcome === 'pass' ? 1 : 0))
            : null,
        lost: lostOf(a),
        failedChecks,
        failure: a.failure ?? null,
        error:
          shown && a.error ? { kind: a.error.kind, message: messageLine(a.error.message) } : null,
      }
    })
    .sort((x, y) => (order.get(x.case ?? '') ?? 0) - (order.get(y.case ?? '') ?? 0))
  return {
    target,
    blocking: blocks(target),
    meanScore: e?.scores?.meanScore ?? null,
    scored,
  }
}

/** The record's outcome, or `canceled` when every gated trial that failed was canceled. */
function outcomeOf(e: EvalEntry): ResultOutcome {
  if (e.outcome !== 'fail') return e.outcome
  const gated = new Set(e.cells.filter((c) => c.gate !== 'none').map((c) => c.key))
  const failed = e.trials.filter((a) => a.outcome === 'fail' && gated.has(a.cell))
  return failed.length && failed.every((a) => a.error?.kind === 'aborted') ? 'canceled' : 'fail'
}

/** A case's outcome as its family's verdict reads it: a failure its family's rate gates passes. */
const caseVerdict = (e: EvalEntry): ResultOutcome =>
  e.verdict === 'family' && e.outcome === 'fail' ? 'pass' : outcomeOf(e)

/** Each question any case asked, in first-asked order, with its votes or answers summed over the cases. */
function familyQuestions(cases: readonly EvalEntry[]): Array<QuestionResult | TrialQuestionResult> {
  const out = new Map<string, QuestionResult | TrialQuestionResult>()
  for (const q of cases.flatMap(questionsOf)) {
    const key = `${q.kind}\0${q.question}`
    const have = out.get(key)
    if (!have) {
      out.set(
        key,
        q.kind === 'pairs'
          ? { ...q, rates: q.rates.map((r) => ({ ...r })) }
          : {
              ...q,
              choices: q.choices?.map((c) => ({ ...c })) ?? null,
              answers: [...q.answers],
            },
      )
      continue
    }
    have.error ??= q.error
    if (have.kind === 'trials' && q.kind === 'trials') {
      have.asked += q.asked
      have.failed += q.failed
      have.answers.push(...q.answers)
      for (const c of q.choices ?? []) {
        const same = have.choices?.find((x) => x.choice === c.choice)
        if (same) same.n += c.n
      }
      continue
    }
    if (have.kind !== 'pairs' || q.kind !== 'pairs') continue
    have.votes += q.votes
    for (const r of q.rates) {
      const same = have.rates.find((x) => x.cut === r.cut && x.name === r.name)
      if (!same) have.rates.push({ ...r })
      else {
        same.wins += r.wins
        same.n += r.n
      }
    }
  }
  return [...out.values()]
}

function familyResult(
  record: RunRecord,
  family: FamilyRecord,
  cases: EvalEntry[],
  order: number,
  folded: EvalEntry | undefined,
): EvalResult {
  const path = factSegment(family.id)
  const sorted = [...cases].sort((a, b) => (a.family?.case ?? 0) - (b.family?.case ?? 0))
  const declared = declaredChecks(sorted)
  const cellOf = (key: string) => sorted.flatMap((c) => c.cells).find((c) => c.key === key)
  const results = sorted.map((c): CaseResult => {
    const label = caseLabel(family.name, c.name)
    const casePath = `${path}/${factSegment(label)}`
    return {
      path: casePath,
      id: c.id,
      label,
      name: c.name,
      order: c.family?.case ?? 0,
      outcome: outcomeOf(c),
      notRun: notRunYet(record, c),
      cells: cellsOf(record, c, casePath, declared),
    }
  })
  return {
    path,
    id: family.id,
    group: family.group,
    name: family.name,
    template: family.name,
    order,
    across: evalAcross(cases.flatMap((c) => c.cells)),
    family: true,
    todo: false,
    notRun: results.every((c) => c.notRun),
    outcome: worst([
      ...(family.outcome === 'fail' ? ['fail' as const] : []),
      ...sorted.map(caseVerdict),
    ]),
    cells: null,
    cases: results,
    pooled: family.lifts.map((lift) => {
      const cell = cellOf(lift.variant)
      return {
        path: `${path}/${cell ? cellSegment(cell) : factSegment(lift.variant)}`,
        key: lift.variant,
        vs: lift.vs,
        effect: pooledEffect(lift),
        pairs: lift.pairs,
        interval: { low: lift.interval.lo, high: lift.interval.hi },
        verdict: lift.verdict,
        minLift: lift.minLift ?? null,
        outcome: lift.outcome,
        measures: familyMeasures(sorted, lift),
      }
    }),
    rates: family.rates.flatMap((r) =>
      r.passRate !== undefined && r.outcome !== undefined
        ? [{ key: r.cell, rate: r.rate, passRate: r.passRate, outcome: r.outcome }]
        : [],
    ),
    questions: familyQuestions(sorted),
    observations: observedTallies(sorted.flatMap((k) => k.trials)),
    ...targetOf(folded),
  }
}

function evalResult(record: RunRecord, e: EvalEntry, order: number): EvalResult {
  const path = factSegment(e.id)
  return {
    path,
    id: e.id,
    group: e.group,
    name: e.name,
    template: null,
    order,
    across: evalAcross(e.cells),
    family: false,
    todo: e.todo,
    notRun: notRunYet(record, e),
    outcome: outcomeOf(e),
    cells: cellsOf(record, e, path, declaredChecks([e])),
    cases: null,
    pooled: null,
    rates: null,
    questions: questionsOf(e),
    observations: observedTallies(e.trials),
    ...targetOf(e),
  }
}

/** Where an eval counts in the tally. */
export function tallyKey(
  e: Pick<EvalResult, 'outcome' | 'blocking'>,
): Exclude<keyof SuiteTally, 'errors' | 'evals'> {
  if (e.outcome === 'infra_error') return 'infraError'
  if (e.outcome === 'canceled' || e.outcome === 'skipped') return e.outcome
  if (!e.blocking) return 'reportOnly'
  return e.outcome === 'pass' ? 'onTarget' : 'below'
}

/** The facts of a run, from its record. Pure: the same record always gives the same result. */
export function suiteResult(folded: RunRecord): SuiteResult {
  const record = unfoldCases(folded)
  const families = new Map((record.families ?? []).map((f) => [f.id, f]))
  const byFile = new Map<string, EvalResult[]>()
  const seen = new Set<string>()
  const errors = record.errors ?? []
  const tally: SuiteTally = {
    errors: errors.length,
    evals: 0,
    onTarget: 0,
    below: 0,
    reportOnly: 0,
    infraError: 0,
    canceled: 0,
    skipped: 0,
  }
  const byId = new Map(folded.evals.map((e) => [e.id, e]))
  const count = (result: EvalResult) => {
    tally[tallyKey(result)]++
    tally.evals++
  }
  for (const e of record.evals) {
    const evals = byFile.get(e.file) ?? []
    byFile.set(e.file, evals)
    const family = e.family && families.get(e.family.id)
    if (!family) {
      const result = evalResult(record, e, evals.length)
      count(result)
      evals.push(result)
      continue
    }
    if (seen.has(family.id)) continue
    seen.add(family.id)
    const cases = record.evals.filter((x) => x.family?.id === family.id)
    const result = familyResult(record, family, cases, evals.length, byId.get(family.id))
    count(result)
    evals.push(result)
  }
  const files = [...byFile]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, evals]) => ({ path, evals }))
  return {
    runId: record.runId,
    status: record.status,
    outcome: runOutcome(folded),
    errors,
    tally,
    files,
  }
}
