import type { ArtifactLevel, RunRecord, RunScope } from '../../history/types.ts'
import type { CompareCut, ErrorKind, Outcome, PassMetric, PassMetricLead } from '../../types.ts'
import type { ActionKind, Confidence } from '../analysis.ts'
import type { AttemptFacts } from '../classify.ts'
import type { CompareStatus } from '../compare.ts'
import type { Remark } from '../remarks.ts'

export type { PassMetric, PassMetricLead }

/** A displayed number: `value` for charts, `text` as every surface prints it (`461k`, `1m 05s`, `not reported`). */
export type Figure = { value: number | null; text: string }
/** `text`: `-42%`, `±0%`, `+50 pts`, `n/a`. */
export type Delta = { value: number | null; unit: 'pct' | 'pts'; text: string }
/** A 95% interval in the parent's unit. `text`: `+66 pts to +100 pts`. */
export type Interval = { lo: number; hi: number; text: string }
export type Spread = { n: number; median: Figure; q1: Figure; q3: Figure }
/** `text`: `12 of 12`. */
export type Count = { k: number; n: number; text: string }
/** `text`: `75%`. `interval` is Wilson's; null at n = 0. */
export type Rate = {
  k: number
  n: number
  rate: number | null
  text: string
  interval: Interval | null
}
/** A proportion as its counts, `k` of `n`; a renderer derives the rate, interval and text. */
export type Proportion = { k: number; n: number }
/** `href` is the citation target (Section 2.10). */
export type AttemptRef = {
  /** The display label, `A1..AN`, numbered over the evals the report covers. */
  id: string
  /** The attempt's `AttemptRecord.key`, the same in every report of its run. */
  key: string
  href: string
}
export type Fairness = 'clear' | 'within-noise' | 'too-few-runs'
export type MeasureKey =
  | 'tokens'
  | 'toolCalls'
  | 'turns'
  | 'costUsd'
  | 'agentMs'
  | 'filesChanged'
  | 'linesAdded'
  | 'linesRemoved'
export type MeasureCells = Record<MeasureKey, Spread | null>
export type EvalShape = 'task' | 'ab' | 'discoverability' | 'regression'

export type RunReport = {
  reportVersion: 1
  runId: string
  /** `evals.length === 1`: the eval is the `#` title and every block moves up one level. */
  single: boolean
  header: RunHeader
  /** Empty when clean; the block is then omitted. */
  integrity: IntegrityIssue[]
  rollup: ExecutiveRollup | null
  /** Empty unless `evals.length >= 2` and two or more harnesses ran. */
  roster: RosterRow[]
  evals: EvalSection[]
  /** From the analysis; empty without one. */
  actions: ReportClaim[]
  provenance: ProvenanceState
  attempts: AttemptIndexRow[]
}

export type RunTally = {
  /** Pass plus fail over gated cells: the pass-rate denominator. */
  counted: number
  passed: number
  failed: number
  /** Ungated cells (baselines by default), never in `counted`. */
  ungated: { passed: number; failed: number }
  infraError: number
  /** Of `infraError`: attempts an unhandled turn error moved out of pass or fail. */
  reclassified: number
  skipped: number
}

export type RunHeader = {
  title: string
  status: RunRecord['status']
  startedAt: string
  author: string
  reeval: string
  profile: string | null
  /** Which runs this one is like-with-like with (`runScope`); unset in reports built before it. */
  scope?: RunScope
  /** Null when cells ran different counts. */
  runsPerCell: number | null
  wall: Figure
  tally: RunTally
  /** `input + output + cacheRead + cacheWrite` (`totalTokens`); null when no attempt reported usage. */
  tokens: { total: Figure; cacheRead: Figure } | null
  /** Null when no attempt or judge call has a cost. */
  cost: {
    agent: Figure | null
    judge: Figure | null
    /** Labeled total when agent and judge are both present; else null. */
    total: Figure | null
    basis: 'reported' | 'estimated' | 'mixed'
  } | null
  /** `repo` is the basename of `git.remote`. */
  git: { sha: string; branch: string | null; dirty: boolean; repo: string | null } | null
}

export type IntegrityKind =
  | 'run-incomplete'
  | 'turn-error'
  | 'pre-satisfied'
  | 'fairness-floor'
  | 'served-model-drift'
  | 'unreported-usage'
  | 'prompt-confounded'
  | 'duplicate-environment'
  | 'baseline-never-passes'
  | 'dirty-worktree'

export type IntegrityIssue = {
  kind: IntegrityKind
  severity: 'error' | 'warn'
  /** One plain sentence that names the metric it affects. */
  text: string
  evalId: string | null
  cites: AttemptRef[]
}

export type ExecutiveRollup = {
  /** `analysis.tldr`; null without an analysis. */
  lead: ReportClaim | null
  rows: Array<{
    evalId: string
    name: string
    anchor: string
    shapes: EvalShape[]
    /** `3 arms × 4 coding harnesses`. */
    design: string
    /** The eval's headline in one cell, in its native unit: `result` as text. */
    primary: string
    /** The headline as numbers; absent in reports built before it. */
    result?: HeadlineResult
    /** Over the eval's counted attempts; not reported on an A/B eval, whose arms are in `medianTokensByArm`. */
    medianTokens: Figure
    /** Each arm's median tokens, from its summary row, on an A/B eval. */
    medianTokensByArm?: Array<{ arm: string; tokens: Figure }>
  }>
  /** Run-level analysis claims (no `evalId`). */
  findings: ReportClaim[]
}

export type RosterRow = {
  harness: string
  model: string | null
  effort: string | null
  servedModels: string[]
  gateway: string | null
  attempts: number
}

export type EvalSection = {
  /** `EvalEntry.key`. */
  id: string
  /** GFM slug of the eval's heading. */
  anchor: string
  /** Unique in the report; `<name> (<file>)` when two evals share a name. */
  name: string
  file: string
  shapes: EvalShape[]
  /** `3 prompts, 4 coding harnesses, 3 arms, 36 attempts`. */
  design: string
  headline: EvalHeadline
  insights: ReportClaim[]
  /** Null on a check-free eval, whose first choice, judge, or measure block leads. */
  primary: TaskResults | VariantComparison | RegressionChanges | null
  choices: ChoiceBreakdown[]
  discovery: DiscoveryRate[]
  judgments: JudgmentBreakdown | null
  qualitative: QualitativeAnswers[]
  captures: CaptureGallery | null
  failures: FailureClusters | null
  /** What to change next: each concern remark that names an edit, as that edit and where. */
  next?: NextStep[]
}

export type NextStep = {
  /** The remark's kind (`too-few-tries`). */
  kind: string
  /** The edit to make (`set runs: 4`). */
  text: string
  /** `evals/a.eval.ts:12`; null when the remark names no place. */
  at: string | null
}

export type ArmRef = { id: string; label: string }

export type EvalHeadline = {
  /** The eval's name: the heading above the headline. */
  task: string
  /** What differed (`Revised skill against the JS SDK baseline`); null on a task eval. */
  kicker: string | null
  fairness: Fairness
  primary: HeadlinePrimary
  /** Sample size, harness count, interval, and floor, as sentences. */
  foot: string
  /** True when every arm in a pass/fail comparison hit 100% across all tasks. */
  saturated?: boolean
}

export type HeadlinePrimary =
  | {
      kind: 'pass-rate'
      /** Pooled pass rate across gated counted attempts (default lead). */
      rate: Rate
      /** Equal-weight mean pass rate across tasks when more than 1 task ran. */
      taskRate?: Figure
      /** Distinct task count when more than 1 task ran. */
      tasks?: number
      assertions: number
      harnesses: number
      /** Product outcome noun: passed (default), found, or used. */
      outcome: 'passed' | 'found' | 'used'
      /** Which pass/fail metric leads when explicitly configured. */
      metric?: PassMetricLead
      /** Explicit trial count `k` when Pass@k / Pass^k were requested. */
      k?: number
      /** Unweighted mean of unbiased per-task `1 - C(n - c, k) / C(n, k)` when every task has `n >= k`. */
      passAtK?: Figure
      /** Unweighted mean of unbiased per-task `C(c, k) / C(n, k)` when every task has `n >= k`. */
      passHatK?: Figure
      /** Reason Pass@k and Pass^k were omitted when `k` was requested (`needs k trials per task ...`). */
      passKOmitted?: string
    }
  | {
      kind: 'lift'
      baseline: ArmRef
      variant: ArmRef
      /** Pooled pass-rate point difference (default lead). */
      points: Delta
      interval: Interval
      baselineRate: Rate
      variantRate: Rate
      /** Equal-weight cross-task baseline pass rate when more than 1 task ran. */
      baselineTaskRate?: Figure
      /** Equal-weight cross-task variant pass rate when more than 1 task ran. */
      variantTaskRate?: Figure
      /** Equal-weight cross-task point difference (`variant` minus `baseline`) when more than 1 task ran. */
      taskPoints?: Delta
      /** Distinct task count when more than 1 task ran. */
      tasks?: number
      /** Which pass/fail metric leads when explicitly configured. */
      metric?: PassMetricLead
      /** Explicit trial count `k` when Pass@k / Pass^k were requested. */
      k?: number
      /** Baseline unweighted unbiased Pass@k when every task has `n >= k`. */
      baselinePassAtK?: Figure
      /** Variant unweighted unbiased Pass@k when every task has `n >= k`. */
      variantPassAtK?: Figure
      /** Variant minus baseline Pass@k points when both arms satisfy `n >= k`. */
      passAtKPoints?: Delta
      /** Baseline unweighted unbiased Pass^k when every task has `n >= k`. */
      baselinePassHatK?: Figure
      /** Variant unweighted unbiased Pass^k when every task has `n >= k`. */
      variantPassHatK?: Figure
      /** Variant minus baseline Pass^k points when both arms satisfy `n >= k`. */
      passHatKPoints?: Delta
      /** Reason Pass@k and Pass^k were omitted when `k` was requested (`needs k trials per task ...`). */
      passKOmitted?: string
      /** True when every arm hit 100% across all tasks. */
      saturated?: boolean
      /** Every other variant, with its own interval; never dropped. */
      others: Array<{
        variant: ArmRef
        points: Delta
        interval: Interval
        rate: Rate
        taskRate?: Figure
        taskPoints?: Delta
        k?: number
        passAtK?: Figure
        passHatK?: Figure
        passKOmitted?: string
      }>
    }
  | {
      kind: 'tied-ceiling'
      baseline: ArmRef
      variant: ArmRef
      rate: Rate
      /** Equal-weight cross-task pass rate when more than 1 task ran. */
      taskRate?: Figure
      /** Distinct task count when more than 1 task ran. */
      tasks?: number
      assertions: number
      lead: { measure: MeasureKey; baseline: Figure; variant: Figure; delta: Delta }
      /** Which pass/fail metric leads when explicitly configured. */
      metric?: PassMetricLead
      /** Explicit trial count `k` when Pass@k / Pass^k were requested. */
      k?: number
      /** Unweighted unbiased Pass@k across tasks when every task has `n >= k`. */
      passAtK?: Figure
      /** Unweighted unbiased Pass^k across tasks when every task has `n >= k`. */
      passHatK?: Figure
      /** Reason Pass@k and Pass^k were omitted when `k` was requested. */
      passKOmitted?: string
      /** True when every arm hit 100% across all tasks. */
      saturated?: boolean
    }
  | {
      kind: 'choice'
      question: string
      options: Array<{ label: string; count: number }>
      attempts: number
      noPick: number
    }
  | {
      kind: 'measure'
      label: string
      unit: 'tokens' | 'ms' | 'usd' | 'count' | 'lines' | 'files'
      spread: Spread
    }
  | {
      kind: 'judge'
      label: string
      question: string
      scale: [number, number]
      threshold: number | null
      spread: Spread
      atOrAbove: Count | null
    }
  | {
      kind: 'text'
      question: string
      answered: Count
      lead: Quote | null
      /** When many answers collapse to one quote shown in the headline. */
      leadRole: 'sole' | 'representative' | null
    }
  | {
      kind: 'regression'
      worse: number
      fixed: number
      /** First gated worse/fixed change, else first change row. */
      lead: ChangeRow | null
    }

/** An eval's headline as numbers only, which `headlineResultText` prints. */
export type HeadlineResult =
  | {
      kind: 'pass-rate'
      passed: Proportion
      outcome: 'passed' | 'found' | 'used'
      /** Equal-weight cross-task pass rate [0, 1] when more than 1 task ran. */
      taskRate?: number
      metric?: PassMetricLead
      k?: number
      passAtK?: number
      passHatK?: number
    }
  | {
      kind: 'lift'
      baseline: string
      variant: string
      baselinePassed: Proportion
      variantPassed: Proportion
      /** Equal-weight cross-task baseline pass rate [0, 1] when more than 1 task ran. */
      baselineTaskRate?: number
      /** Equal-weight cross-task variant pass rate [0, 1] when more than 1 task ran. */
      variantTaskRate?: number
      /** Pass-rate points as a fraction (`1` is +100 pts), with its 95% interval. */
      points: number
      lo: number
      hi: number
      metric?: PassMetricLead
      k?: number
      baselinePassAtK?: number
      variantPassAtK?: number
      baselinePassHatK?: number
      variantPassHatK?: number
      saturated?: boolean
    }
  | {
      kind: 'tied-ceiling'
      baseline: string
      variant: string
      passed: Proportion
      measure: MeasureKey
      baselineMedian: number
      variantMedian: number
      metric?: PassMetricLead
      k?: number
      passAtK?: number
      passHatK?: number
      saturated?: boolean
    }
  | {
      kind: 'choice'
      question: string
      options: Array<{ label: string; count: number }>
      attempts: number
    }
  | {
      kind: 'measure'
      label: string
      unit: 'tokens' | 'ms' | 'usd' | 'count' | 'lines' | 'files'
      /** Null when no attempt reported it. */
      median: number | null
      n: number
    }
  | { kind: 'judge'; label: string; scale: [number, number]; median: number | null; n: number }
  | { kind: 'text'; question: string; answered: Proportion }
  | { kind: 'regression'; worse: number; fixed: number; lead: ChangeRow | null }

export type CheckCell = {
  status: 'pass' | 'fail' | 'mixed' | 'na' | 'error' | 'not-run'
  passed: number
  /** Pass plus fail; never counts `notApplicable`. */
  answered: number
  notApplicable: number
  preSatisfied: number
  /** `12 of 12`, `0 of 4`, `n/a`, `12 of 12, 12 pre-satisfied`. */
  text: string
  /** Why the check was n/a when known (`expect.skip` reason); null otherwise. */
  reason: string | null
}

export type AssertionRow = {
  label: string
  matcher: string
  at: string | null
  /** One entry per column key; every column present. */
  cells: Record<string, CheckCell>
  total: CheckCell
}

export type TaskCell = {
  rate: Rate
  /** Explicit trial count `k` when Pass@k / Pass^k were requested. */
  k?: number
  /** Unbiased `1 - C(n - c, k) / C(n, k)` on this task when `n >= k`. */
  passAtK?: Figure
  /** Unbiased `C(c, k) / C(n, k)` on this task when `n >= k`. */
  passHatK?: Figure
  /** Reason Pass@k and Pass^k were omitted on this task when `n < k`. */
  passKOmitted?: string
}

export type TaskRow = {
  /** Stable task key (`CaseRecord.key` or prompt key). */
  task: string
  /** Human-readable task label. */
  label: string
  /** One entry per column key (coding harness on task evals, arm label on comparisons). */
  cells: Record<string, TaskCell>
  /** Overall task score across gated/counted attempts on task evals; null on arm comparisons. */
  total: TaskCell | null
}

export type BreakdownRow = {
  /** One value per axis, repeated on every row. */
  keys: string[]
  /** Pooled pass rate across counted attempts in this group. */
  rate: Rate | null
  /** Equal-weight mean pass rate across tasks when more than 1 task ran. */
  taskRate?: Figure | null
  /** Explicit trial count `k` when Pass@k / Pass^k were requested. */
  k?: number
  /** Unweighted mean of unbiased per-task Pass@k when every task has `n >= k`. */
  passAtK?: Figure
  /** Unweighted mean of unbiased per-task Pass^k when every task has `n >= k`. */
  passHatK?: Figure
  /** Reason Pass@k and Pass^k were omitted when `k` was requested and some task has `n < k`. */
  passKOmitted?: string
  measures: MeasureCells
  /** Total counted cost divided by passing attempts; null when cost unreported or 0 passes. */
  costPerSuccess?: Figure | null
}

export type TaskResults = {
  kind: 'task'
  columns: string[]
  assertions: AssertionRow[]
  axes: string[]
  breakdown: BreakdownRow[]
  /** The cross-group median row; null with one group. */
  median: BreakdownRow | null
  /** Which pass/fail metric leads when explicitly configured. */
  metric?: PassMetricLead
  /** Explicit trial count `k` when Pass@k / Pass^k were requested. */
  k?: number
  /** Overall unweighted unbiased Pass@k across tasks when every task has `n >= k`. */
  passAtK?: Figure
  /** Overall unweighted unbiased Pass^k across tasks when every task has `n >= k`. */
  passHatK?: Figure
  /** Reason Pass@k and Pass^k were omitted when `k` was requested and some task has `n < k`. */
  passKOmitted?: string
  /** True when at least one counted attempt reported USD cost. */
  costReported?: boolean
  /** Per-task pass rates when more than 1 task ran. */
  tasks?: TaskRow[]
}

export type Arm = {
  id: string
  label: string
  environment: string
  environmentDigest: string | null
  role: 'baseline' | 'variant'
  change: string | null
  /** Distinct first-turn prompt hashes over the arm's attempts. */
  prompts: string[]
  /** Whether every one of the arm's cells is gated (a baseline's default `gate: 'none'` isn't). */
  gated?: boolean
}

export type MeasureVsBaseline = {
  value: Spread | null
  delta: Delta | null
  /** `3 of 4` harnesses lower than the baseline; null on the baseline. */
  lower: Count | null
}

export type ArmRow = {
  arm: string
  /** Pooled pass rate across counted attempts on this arm. */
  rate: Rate
  /** Equal-weight mean pass rate across tasks when more than 1 task ran. */
  taskRate?: Figure
  /** Equal-weight cross-task point lift against baseline when more than 1 task ran; null on baseline. */
  taskLift?: Delta | null
  /** Explicit trial count `k` when Pass@k / Pass^k were requested. */
  k?: number
  /** Unweighted mean of unbiased per-task Pass@k when every task has `n >= k`. */
  passAtK?: Figure
  /** Unweighted mean of unbiased per-task Pass^k when every task has `n >= k`. */
  passHatK?: Figure
  /** Reason Pass@k and Pass^k were omitted on this arm when `k` was requested and some task has `n < k`. */
  passKOmitted?: string
  lift: Delta | null
  interval: Interval | null
  /** Pass-rate certainty only; measure direction lives in measure cells. */
  verdict: 'baseline' | 'helped' | 'made-worse' | 'within-noise' | 'too-few-runs'
  /** Always `pass-rate` for this column today. */
  verdictScope: 'pass-rate'
  measures: Record<MeasureKey, MeasureVsBaseline>
  /** Total counted cost divided by passing attempts; null when cost unreported or 0 passes. */
  costPerSuccess?: Figure | null
  /** Percentage delta of costPerSuccess against baseline; null on baseline or when either side is null. */
  costPerSuccessDelta?: Delta | null
}

export type EffortPivotRow = {
  /** A harness label, or `Median` for the cross-harness row. */
  harness: string
  arm: string
  /** Pooled pass rate for this harness and arm. */
  rate: Rate
  /** Equal-weight mean pass rate across tasks when more than 1 task ran. */
  taskRate?: Figure
  /** Explicit trial count `k` when Pass@k / Pass^k were requested. */
  k?: number
  /** Unweighted mean of unbiased per-task Pass@k when every task has `n >= k`. */
  passAtK?: Figure
  /** Unweighted mean of unbiased per-task Pass^k when every task has `n >= k`. */
  passHatK?: Figure
  /** Reason Pass@k and Pass^k were omitted when `k` was requested and some task has `n < k`. */
  passKOmitted?: string
  measures: Record<MeasureKey, MeasureVsBaseline>
  /** Total counted cost divided by passing attempts; null when cost unreported or 0 passes. */
  costPerSuccess?: Figure | null
  /** Percentage delta of costPerSuccess against this harness's baseline; null on baseline or when either side is null. */
  costPerSuccessDelta?: Delta | null
}

export type BehaviorRow = { label: string; matcher: string; cells: Record<string, Count | null> }

/**
 * `from` against `to` on one coding harness and sandbox: each pair has a row per harness (and
 * sandbox), whose interval is over that cell's attempts alone.
 */
export type ContrastRow = {
  from: string
  to: string
  /** The coding harness both cells ran on; absent in reports built before it. */
  harness?: string
  /** The sandbox both cells ran in. */
  sandbox?: string
  /** `from`'s counted attempts that passed. */
  fromPassed?: Proportion
  /** `to`'s counted attempts that passed. */
  toPassed?: Proportion
  /** Equal-weight cross-task point delta (`from` minus `to`) when more than 1 task ran. */
  taskDelta?: Delta
  /** Tasks where `from` scored 0% on multi-task evaluations; omitted when none or single-task. */
  brokenTasks?: string[]
  measure: 'pass-rate' | MeasureKey
  delta: Delta
  interval: Interval | null
  verdict: 'helped' | 'made-worse' | 'within-noise' | 'too-few-runs' | 'fewer' | 'more'
  /** `pass-rate` when the contrast is on pass rate; else the measure's own direction. */
  verdictScope: 'pass-rate' | 'measure'
}

export type VariantComparison = {
  kind: 'comparison'
  /** Baseline first, then variants in declaration order. */
  arms: Arm[]
  /** Set when every arm passed every applicable assertion; `assertionsByArm` is then empty. */
  uniformLead: string | null
  /** Which pass/fail metric leads when explicitly configured. */
  metric?: PassMetricLead
  /** Explicit trial count `k` when Pass@k / Pass^k were requested. */
  k?: number
  /** True when at least one counted attempt reported USD cost. */
  costReported?: boolean
  /** True when every arm hit 100% across all tasks. */
  saturated?: boolean
  /** Plain-language saturation explanation when `saturated` is true; null otherwise. */
  saturationNote?: string | null
  summary: ArmRow[]
  /** Per-task pass rates by arm when more than 1 task ran. */
  tasks?: TaskRow[]
  assertionsByArm: AssertionRow[]
  behavior: BehaviorRow[]
  /** From `contrastsOf`; empty with one variant. */
  contrasts: ContrastRow[]
  effortByHarness: EffortPivotRow[]
}

export type ChangeRow = {
  signal: string
  kind: 'outcome' | 'assertion' | 'judgment' | 'choice' | 'measure' | 'observation'
  harness: string | null
  /** `priorPassed` as text when set, else the comparison's own value. */
  prior: string
  current: string
  /** The prior run's counted attempts that passed; null when the row has no counts. */
  priorPassed?: Proportion | null
  currentPassed?: Proportion | null
  delta: Delta | null
  status: CompareStatus
  gate: boolean
}

export type RegressionChanges = {
  kind: 'regression'
  baseRunId: string
  /** Prior-run identity for reproducible comparison. */
  prior: {
    runId: string
    startedAt: string
    gitSha: string | null
    branch: string | null
    author: string
  }
  /** Experimental inputs that changed (`stackChanges` / config), not outcome rows. */
  whatChanged: string[]
  rows: ChangeRow[]
  unchanged: ChangeRow[]
}

export type ChoiceBreakdown = {
  question: string
  /** Sorted by count, then by first appearance. */
  options: Array<{ label: string; count: number }>
  noPick: number
  rows: Array<{
    arm: string | null
    prompt: string | null
    harness: string
    counts: Record<string, number>
    attempts: number
    /** Each option's count out of the row's attempts, in `options` order. */
    picks?: Array<{ option: string } & Proportion>
    /** `counts` as text. */
    text: string
  }>
  passByPick: Array<{ option: string; rate: Rate }>
}

export type DiscoveryRate = {
  what: string
  matcher: string
  found: Count
  rows: Array<{ keys: string[]; found: Count }>
  /**
   * For a skill, the attempts that found it by where the skill they checked came from, its first
   * use in the report's `facts`: one source an attempt, so the counts sum to at most `found`. An
   * attempt counts in none when it has no facts, when its passing `toHaveCalledSkill` had a label
   * of its own (which doesn't name the skill), when the check that found it was a `not.`, or when
   * the matcher passed on a call the facts leave out (a failed call, or a file under
   * `skills/<name>/` that isn't its `SKILL.md`). Empty without facts.
   */
  sources: Array<{ source: 'placed' | 'skill-dir' | 'elsewhere' | 'mcp' | 'web'; count: number }>
}

export type JudgeRow = {
  label: string
  question: string
  /** The `expect(verdict).toPass()` label that gates on it; null for a diagnostic judgment. */
  assertion: string | null
  threshold: number | null
  keys: string[]
  spread: Spread
  /** Null when `threshold` is null (diagnostic): omit from "At or above". */
  atOrAbove: Count | null
  /** Each score behind `spread`, one per judge call; absent in reports built before it. */
  scores?: JudgeScore[]
}

export type JudgeScore = {
  /** The attempt's index id (`A3`) and `AttemptRecord.key`. */
  attempt: string
  key: string
  /** One value per `JudgeRow.keys` axis. */
  keys: string[]
  score: number
  /** The judge's own verdict on its threshold. */
  verdict: 'pass' | 'fail'
  outcome: AttemptIndexRow['outcome']
}

export type PairwiseRow = {
  question: string
  cut: CompareCut
  a: string
  b: string
  aWins: number
  bWins: number
  ties: number
  pairs: number
  reasons: Array<{ text: string; cites: [AttemptRef, AttemptRef]; input: string | null }>
}

export type JudgmentBreakdown = { axes: string[]; scores: JudgeRow[]; pairwise: PairwiseRow[] }

export type Quote = {
  text: string
  attempt: AttemptRef
  harness: string
  arm: string | null
  case: string | null
  input: string | null
}

export type QualitativeAnswers = {
  question: string
  answered: Count
  /** From the analysis; null without one. */
  themes: Array<{ title: string; quotes: Quote[] }> | null
  entries: Quote[]
}

export type CaptureShot = {
  name: string
  /** Null when not kept. */
  href: string | null
  meta: string | null
  attempt: AttemptRef
  status: number | null
  pageErrors: number | null
  consoleErrors: number | null
}

export type CaptureGallery = {
  rows: Array<{ harness: string; arm: string | null; case: string | null; shots: CaptureShot[] }>
}

export type FailureCluster = {
  /**
   * `error` is an attempt error no other cluster explains: never the failed `expect` behind an
   * `assertion` cluster, and an `infra-error` is never the turn error behind a `turn-error` one.
   */
  kind: 'assertion' | 'turn-error' | 'infra-error' | 'capture-error' | 'error'
  label: string
  at: string | null
  /**
   * An `assertion` cluster's failure message, its first attempt's, as that attempt's `error` has
   * it when the check ended the body; absent on other kinds, whose `label` is the message.
   */
  message?: string
  /** Members of the eval's counted attempts. */
  count: Count
  attempts: AttemptRef[]
}

export type FailureClusters = {
  clusters: FailureCluster[]
  remarks: Array<{
    kind: Remark['kind']
    severity: Remark['severity']
    text: string
    fix: Remark['fix']
    /** `text`, with `fix`'s place when it names no edit (`… At evals/a.eval.ts:12.`); an edit is in the section's `next`. */
    line?: string
  }>
}

export type ReportClaim = {
  role: 'finding' | 'caveat' | 'action'
  text: string
  confidence: Confidence
  cites: AttemptRef[]
  action: { kind: ActionKind; target: string; change: string; verify: string | null } | null
}

export type ProvenanceState = {
  /** `stateRows` without its `Context` row. */
  rows: Array<{ field: string; value: string }>
  context: { count: number; files: Array<{ path: string; sha256: string }> }
  artifacts: ArtifactLevel
  /** `../<runId>.json`. */
  record: string
  warnings: string[]
}

export type AttemptIndexRow = {
  id: string
  /** `AttemptRecord.key`. */
  key: string
  evalId: string
  harness: string
  arm: string | null
  case: string | null
  outcome: Exclude<Outcome, 'skipped'> | 'canceled'
  reclassified: boolean
  turnError: string | null
  /** Whether the attempt's cell is gated, so its outcome counts toward the pass rate. */
  gated?: boolean
  /** Each failed assertion, in the order the eval made them; `message` is its first informative line. */
  failed?: Array<{ label: string; at: string | null; message: string }>
  /**
   * Why the attempt failed, its message's first informative line; null when nothing did. An
   * `assertion` error is the failed `expect` that ended the body, so its message repeats one of
   * `failed`'s when the eval had one.
   */
  error?: { kind: ErrorKind; message: string } | null
  /** What the harness or gateway said it cost, else its tokens at list price; null when unpriced. */
  cost?: { usd: number; text: string; basis: 'reported' | 'estimated' } | null
  /** Each question asked of the attempt on its own, in asked order; `model` is the one that served it. */
  answers?: Array<{
    question: string
    model: string
    /** Null on a free-text question and when the call failed. */
    choice: string | null
    text: string
    /** Why there's no answer; null when the call succeeded. */
    error: string | null
  }>
  tokens: Figure
  agentMs: Figure
  toolCalls: Figure
  /** The tokens `tokens` adds up; null when the harness reported none, absent before it. */
  usage?: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    /** Of `output`; null when the harness doesn't say. */
    reasoning: number | null
  } | null
  /** Where the attempt's time went, by phase, and the agent's turns by what they waited on. */
  time?: {
    setupMs: number
    agentMs: number
    diffMs: number
    checksMs: number
    judgeMs: number
    /** Null when no turn split its time. */
    agent: { modelMs: number | null; toolMs: number; waitingMs: number; otherMs: number } | null
  }
  /** The attempt's judge calls, in call order, labeled as `JudgeRow.label`. */
  judgments?: Array<{
    label: string
    score: number
    threshold: number
    verdict: 'pass' | 'fail'
    /** Whether a `toPass` assertion gated on it. */
    gated: boolean
  }>
  /**
   * What its transcript shows it did, from the report's `facts`; absent when the report had none
   * for it, such as a passing attempt whose transcript `evidence` didn't keep.
   */
  facts?: AttemptFacts
  /** Lines exclude lockfiles; null counts print `not recorded`. */
  diff: { files: number; added: number | null; removed: number | null; text: string } | null
  links: {
    transcript: string | null
    diff: string | null
    captures: Array<{ name: string; href: string }>
    questions: string[]
  }
  /** The target every `AttemptRef` to this attempt uses. */
  href: string
}

export type BlockMarkdown = {
  runHeader(header: RunHeader, single: boolean): string
  integrity(issues: IntegrityIssue[]): string
  rollup(rollup: ExecutiveRollup): string
  roster(rows: RosterRow[]): string
  evalSection(section: EvalSection, single: boolean): string
  actions(claims: ReportClaim[]): string
  provenance(state: ProvenanceState): string
  attemptIndex(rows: AttemptIndexRow[], single: boolean): string
}
