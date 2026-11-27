// The run's plan: what it will start, how long that should take, and whether it fits the budget.
import { acrossOf, type PairTrial, pairFactors, pairsOf, plannedSides } from './compare/pairs.ts'
import { questionShows, resolveQuestionState } from './compare/state.ts'
import { type CostedTrial, type PlanCost, planCost } from './cost.ts'
import type { ExcludedEval, PlannedItem } from './engine/node.ts'
import { inCI } from './env.ts'
import { NO_ENVIRONMENT } from './environment.ts'
import { UsageError } from './errors.ts'
import { fallbackHint } from './gateway/resolve.ts'
import { noDefaultEffort } from './harness/default-effort.ts'
import { harnessEffort } from './harness/effort.ts'
import { caseKeyOf } from './history/cases.ts'
import { recentRecords, scratchDir } from './history/files.ts'
import type { RunRecord } from './history/types.ts'
import { inputPath } from './inputs.ts'
import { majorityOf } from './options.ts'
import type { Prices } from './prices.ts'
import { providerLimit, sandboxKind } from './sandbox/kinds.ts'
import { COMPARE_TRIALS, PAIRED_MIN } from './stats.ts'
import { blocks, DEFAULT_TARGET, targetLabel } from './target.ts'
import { clip, formatDuration, plural } from './text.ts'
import type {
  Budget,
  Cell,
  CellGate,
  CursorEfforts,
  Duration,
  EvalPlan,
  ExcludedPair,
  FamilyMeta,
  HarnessDescriptor,
  LocalInput,
  LocalInputKind,
  PairFactor,
  PlannedEgress,
  PlannedGrader,
  PlannedQuestion,
  ResolvedGateway,
  ResolvedProfile,
  Revision,
  SandboxDescriptor,
  SandboxWarning,
  Target,
} from './types.ts'
import type { RunHeader } from './ui/events.ts'
import { EFFORT_MIN_TRIALS } from './view/effort.ts'

/**
 * With no history for a harness, a trial is assumed to take this long. The fake agent takes
 * no time, so its trial is the sandbox's: 1s in the fake sandbox, and in a container the start,
 * the workspace, `setup` steps such as an install, and the checks.
 */
const DEFAULT_TRIAL_MS = 3 * 60_000
const DEFAULT_FAKE_MS = 1000
const DEFAULT_SANDBOX_SETUP_MS = 30_000
/** The most recent runs whose durations and tokens feed the estimates. */
const HISTORY_RUNS = 30

export type PlanRow = {
  id: string
  plan: EvalPlan
  /** Set on each case of an eval with `cases`. */
  family?: FamilyMeta
  /** Optimistic pair sides for `--dry-run`: every planned trial is assumed to pass checks. */
  sides: PairTrial[]
}

export type RunPlan = {
  profile: ResolvedProfile | null
  rows: PlanRow[]
  /** Evals that run; an eval with cases is one, however many of its cases run. */
  evals: number
  /** Evals none of whose rows run. */
  skipped: number
  cells: number
  /** Every trial the plan may start: with `trials: { bestOf }`, its upper bound. */
  trials: number
  /** The trials that start whatever the results: below `trials` when best-of cells may stop early. */
  fewest: number
  /** Serial: every trial one after another, best-of cells at their most. */
  estimateMs: number
  /** How many trials run at once: `concurrency`, held to the trials and each provider's cap. */
  parallel: number
  /** Agent and judge tokens, and their cost when there are prices; only for `--dry-run`. */
  cost?: PlanCost
  concurrency: number
  budget: Budget
  warnings: string[]
  /** One per level whose sandbox runs as root, with capabilities added back or with host devices. */
  sandboxWarnings: SandboxWarning[]
  /** Advice that doesn't stop the run, e.g. that an eval can't fail CI. */
  hints: string[]
  sandboxes: SandboxDescriptor[]
  /** The sandboxes the planned trials' graders start, which a killed run's cleanup sweeps too. */
  graderSandboxes: SandboxDescriptor[]
  /** The harnesses the planned trials run on, for their credentials. */
  harnessDescriptors: HarnessDescriptor[]
  /** The harness ids the planned trials run on, for the run header. */
  harnesses: string[]
  /**
   * The effort each of those harnesses runs at, by id: its level, `none`, or `not checked` for
   * a Cursor model whose catalog wasn't read. The fake harness has none.
   */
  efforts: Record<string, string>
  /** The model that answers a question naming none; null when there's no language model. */
  /** The model that answers a question naming none; null when there's no language model. */
  questionModel: string | null
  /** The run this plan belongs to, minted or resumed before collect. */
  runId?: string
  /**
   * Set when this plan continues a stopped, interrupted or budget-stopped run, or retries a
   * finished one: the trials it keeps, and how many of the ones it runs ended in an infra error.
   */
  resume?: { runId: string; completed: number; retried?: number }
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

/** Trial durations from the latest recorded and scratch runs, by eval and harness. */
function historyDurations(records: RunRecord[]) {
  const byEval = new Map<string, number[]>()
  const byHarness = new Map<string, number[]>()
  const push = (map: Map<string, number[]>, key: string, ms: number) =>
    map.set(key, [...(map.get(key) ?? []), ms])
  for (const record of records) {
    for (const e of record.evals ?? []) {
      for (const a of e.trials ?? []) {
        if (a.outcome !== 'pass' && a.outcome !== 'fail') continue
        const harness = e.cells?.find((c) => c.key === a.cell)?.harness
        if (!harness) continue
        push(byEval, `${e.id}\0${harness}`, a.durationMs)
        push(byHarness, harness, a.durationMs)
      }
    }
  }
  return (id: string, harness: string, kind: string, sandbox: string) => {
    const own = byEval.get(`${id}\0${harness}`)
    if (own?.length) return median(own)
    const any = byHarness.get(harness)
    if (any?.length) return median(any)
    if (kind !== 'fake') return DEFAULT_TRIAL_MS
    return sandbox === 'fake' ? DEFAULT_FAKE_MS : DEFAULT_SANDBOX_SETUP_MS
  }
}

export async function buildPlan(options: {
  planned: PlannedItem[]
  profile: ResolvedProfile | null
  budget: Budget
  concurrency: number
  root: string
  historyDir: string
  questionModel?: string | null
  /** The run's judge model, `fake` for a fake judge; null or unset when there's none. */
  judgeModel?: string | null
  /** Prices for the cost estimate, which only `--dry-run` shows; unset leaves it out. */
  prices?: Prices
  /** What Cursor's catalog says of each Cursor model's effort; unset when it wasn't read. */
  cursorEfforts?: CursorEfforts
}): Promise<RunPlan> {
  const { planned } = options
  const records = await recentRecords([options.historyDir, scratchDir(options.root)], HISTORY_RUNS)
  const estimate = historyDurations(records)
  const costed: CostedTrial[] = []
  const rows = new Map<string, PlanRow>()
  const cells = new Set<string>()
  const warnings = new Set<string>()
  const sandboxWarnings = new Map<string, SandboxWarning>()
  const sandboxes = new Map<string, SandboxDescriptor>()
  const graderSandboxes = new Map<string, SandboxDescriptor>()
  const descriptors = new Map<string, HarnessDescriptor>()
  const harnesses = new Set<string>()
  // One harness id can run at two efforts when evals route it through different gateways.
  const efforts = new Map<string, Set<string>>()
  // A filter can leave out some of an eval's cells: each row counts what it actually plans.
  const counted = new Map<
    string,
    {
      harnesses: Set<string>
      variants: Set<string>
      n: number
      baselines: Set<string>
      variantSides: Set<string>
    }
  >()
  let trials = 0
  let fewest = 0
  let estimateMs = 0
  const limits = new Map<string, number>()
  let uncapped = false
  for (const { id, trial } of planned) {
    const existing = rows.get(id)
    if (!existing || existing.plan.skip) {
      rows.set(id, {
        id,
        plan: trial.plan,
        sides: [],
        ...(trial.family ? { family: trial.family } : {}),
      })
    }
    for (const w of trial.plan.warnings) warnings.add(w)
    if (trial.skip || trial.plan.skip) continue
    for (const w of trial.plan.sandboxWarnings) {
      sandboxWarnings.set(`${w.file}\0${w.message}`, w)
    }
    trials++
    if (trial.bestOf === undefined || trial.n <= majorityOf(trial.bestOf)) fewest++
    cells.add(`${trial.family?.id ?? id}\0${trial.cell.key}`)
    estimateMs += estimate(id, trial.cell.harness, trial.harness.kind, trial.sandbox.kind)
    const provider = sandboxKind(trial.sandbox).provider(trial.sandbox)
    const limit = providerLimit(trial.sandbox)
    if (limit === undefined) uncapped = true
    else limits.set(provider, Math.max(limits.get(provider) ?? limit, limit))
    costed.push({ id, cell: trial.cell, harness: trial.harness })
    sandboxes.set(JSON.stringify(trial.sandbox), trial.sandbox)
    for (const { sandbox } of trial.graderSandboxes ?? []) {
      graderSandboxes.set(JSON.stringify(sandbox), sandbox)
    }
    descriptors.set(JSON.stringify(trial.harness), trial.harness)
    harnesses.add(trial.cell.harness)
    if (trial.harness.kind !== 'fake') {
      const effort =
        harnessEffort(trial.harness) ??
        (noDefaultEffort(trial.harness, options.cursorEfforts) === 'unchecked'
          ? 'not checked'
          : 'none')
      const seen = efforts.get(trial.cell.harness) ?? new Set<string>()
      efforts.set(trial.cell.harness, seen.add(effort))
    }
    const row = counted.get(id) ?? {
      harnesses: new Set(),
      variants: new Set(),
      n: 0,
      baselines: new Set(),
      variantSides: new Set(),
    }
    row.harnesses.add(trial.cell.harness)
    if (trial.cell.variant !== undefined) row.variants.add(trial.cell.variant)
    const side = `${trial.cell.harness}\0${trial.cell.sandbox}`
    if (trial.cell.role === 'baseline') row.baselines.add(side)
    else if (trial.cell.role === 'variant') row.variantSides.add(side)
    row.n++
    counted.set(id, row)
  }
  for (const row of rows.values()) {
    const c = counted.get(row.id)
    if (!c) continue
    const { variants } = row.plan
    row.plan = {
      ...row.plan,
      harnesses: c.harnesses.size,
      variants: variants && { run: c.variants.size, of: variants.of },
      totalTrials: c.n,
    }
    row.sides = plannedSides(
      planned
        .filter((p) => p.id === row.id && !p.trial.skip && !p.trial.plan.skip)
        .map((p) => p.trial),
    )
  }
  // A lift needs a variant and the baseline on its harness and sandbox in the same run.
  const lifted = (r: PlanRow) => {
    const c = counted.get(r.id)
    return !r.plan.skip && !!c && [...c.variantSides].some((s) => c.baselines.has(s))
  }
  const units = evalUnits([...rows.values()])
  const running = units.filter((u) => u.some((r) => !r.plan.skip)).length
  return {
    profile: options.profile,
    rows: [...rows.values()],
    evals: running,
    skipped: units.length - running,
    cells: cells.size,
    trials,
    fewest,
    estimateMs,
    parallel: Math.max(
      1,
      Math.min(
        options.concurrency,
        trials,
        uncapped ? Number.POSITIVE_INFINITY : [...limits.values()].reduce((a, b) => a + b, 0),
      ),
    ),
    ...(options.prices
      ? { cost: planCost(costed, records, options.judgeModel ?? null, options.prices) }
      : {}),
    concurrency: options.concurrency,
    budget: options.budget,
    warnings: [...warnings],
    sandboxWarnings: [...sandboxWarnings.values()].sort(
      (a, b) => Number(a.kind !== 'root') - Number(b.kind !== 'root'),
    ),
    hints: [
      ...targetHint(units),
      ...verdictHint([...rows.values()].filter(lifted)),
      ...familyHints([...rows.values()].filter(lifted)),
      ...gatewayHints(planned),
    ],
    sandboxes: [...sandboxes.values()],
    graderSandboxes: [...graderSandboxes.values()],
    harnessDescriptors: [...descriptors.values()],
    harnesses: [...harnesses],
    efforts: Object.fromEntries([...efforts].map(([id, set]) => [id, [...set].join(' or ')])),
    questionModel: options.questionModel ?? null,
  }
}

export type PlanQuestion = {
  question: string
  /** Its own model, else the plan's question model; null when there's no language model. */
  model: string | null
  /** The factors its pairs vary; unset when it's asked of each trial on its own. */
  across?: PairFactor[]
  /** A pairwise question's pairs, assuming every trial passes its checks. */
  pairs?: number
  /** A per-trial question's trials, assuming every trial runs to a pass or a fail. */
  trials?: number
  /** The answers a per-trial question picks from; unset for a free-text answer. */
  choices?: string[]
  /** The parts each side shows: its `state` keys that are on, then `artifacts` when it sends captures. */
  shows: string[]
}

const count = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

/**
 * `environment · 2 pairs` for a pairwise question, `each trial · 4 trials · yes / no` for
 * one asked of each trial on its own.
 */
export const questionPairLabel = (
  q: Pick<PlanQuestion, 'across' | 'pairs' | 'trials' | 'choices'>,
): string => {
  if (q.across) return `${q.across.join(', ')} · ${count(q.pairs ?? 0, 'pair')}`
  const choices = q.choices ? ` · ${q.choices.join(' / ')}` : ''
  return `each trial · ${count(q.trials ?? 0, 'trial')}${choices}`
}

/** An eval's questions, each with the model that will answer it and how many times it's asked. */
export const planQuestions = (
  questions: PlannedQuestion[] | undefined,
  sides: PairTrial[],
  questionModel: string | null,
  skip?: string,
): PlanQuestion[] =>
  (skip ? [] : (questions ?? [])).map((q) => {
    return {
      question: q.question,
      model: q.model ?? questionModel,
      ...(q.across !== undefined
        ? { across: pairFactors(q.across), pairs: pairsOf(sides, acrossOf(q.across)).length }
        : { trials: sides.length }),
      ...(q.choices ? { choices: q.choices } : {}),
      shows: questionShows(resolveQuestionState(q.state), q.artifacts),
    }
  })

/**
 * `  question 1/2  Which is cleaner? · after the run · … · environment · 4 pairs · …`, or
 * `· after each trial · … · each trial · 4 trials · …` for one asked of each trial.
 */
function questionLines(members: PlanRow[], questionModel: string | null): string[] {
  const [first] = members
  if (!first) return []
  const asked = members.map((row) =>
    planQuestions(row.plan.questions, row.sides, questionModel, row.plan.skip),
  )
  const questions = (asked[0] ?? []).map((q, i) => ({
    ...q,
    ...(q.across
      ? { pairs: asked.reduce((sum, list) => sum + (list[i]?.pairs ?? 0), 0) }
      : { trials: asked.reduce((sum, list) => sum + (list[i]?.trials ?? 0), 0) }),
  }))
  return questions.map(
    (q, i) =>
      `  question ${i + 1}/${questions.length}  ${clip(q.question, 80)} · ${q.across ? 'after the run' : 'after each trial'} · shows ${q.shows.join(', ')} · ${questionPairLabel(q)} · ${q.model ?? 'needs a language model: set analysis.model'}`,
  )
}

/** `  grader 1/2  used-skill:http-retries · built-in · weight 2 · required`, for each grader. */
function graderLines(members: PlanRow[]): string[] {
  const graders = members.find((r) => !r.plan.skip)?.plan.graders ?? []
  return graders.map(
    (g, i) =>
      `  grader ${i + 1}/${graders.length}  ${clip(g.name, 80)} · ${g.kind === 'builtin' ? 'built-in' : g.kind} · ${g.recordsOnly || (g.weight === 0 && !g.required) ? 'records only' : `weight ${g.weight}`}${g.required ? ' · required' : ''}`,
  )
}

/** A case of an eval with two cases or more, which pools them. */
const pooledCase = (r: Pick<PlanRow, 'family'>) => (r.family?.cases ?? 0) >= 2

/** The plan's rows by eval: an eval with cases is its cases' rows, the rest a row each. */
function evalUnits(rows: PlanRow[]): PlanRow[][] {
  const units = new Map<string, PlanRow[]>()
  for (const row of rows) {
    const id = row.family?.id ?? row.id
    units.set(id, [...(units.get(id) ?? []), row])
  }
  return [...units.values()]
}

/** One line in CI when evals run whose target can't fail the run, so a miss can't fail CI. */
function targetHint(units: PlanRow[][]): string[] {
  if (!inCI()) return []
  const ids = units
    .filter((u) => u.some((r) => !r.plan.skip && !blocks(r.plan.target)))
    .map(([r]) => clip(r?.family?.id ?? r?.id ?? '', 64))
  const n = ids.length
  if (n === 0) return []
  const named = n > 3 ? `${ids.slice(0, 3).join(', ')} and ${n - 3} more` : ids.join(', ')
  return [
    `${plural(n, 'eval')} can't fail CI (${named}): ${n === 1 ? 'its target only reports' : 'their targets only report'}; set target: regression() (or capability(1, { blocking: true })) in the eval or the config to fail on a miss`,
  ]
}

/** The trials a side the plan suggests, so a compare's lift can hold and its effort can be tested. */
const VERDICT_MIN_TRIALS = Math.max(COMPARE_TRIALS, EFFORT_MIN_TRIALS)

/**
 * One line when compares outside a family run too few times per cell for their lift to hold: it
 * shows the direction the trials went, and their effort can't be tested. `rows` are those that
 * plan a lift.
 */
function verdictHint(rows: PlanRow[]): string[] {
  const few = rows.filter((r) => !pooledCase(r) && r.plan.trials < VERDICT_MIN_TRIALS)
  if (few.length === 0) return []
  const counts = [...new Set(few.map((r) => r.plan.trials))].sort((a, b) => a - b)
  const trials = counts.length === 1 && counts[0] === 1 ? 'once' : `${counts.join(' or ')} times`
  const one = few.length === 1
  const capped = new Set(few.map((r) => r.plan.notes.map(cappedBy).find(Boolean)))
  const [profile] = capped
  const fix =
    capped.size === 1 && profile
      ? `profile ${profile}'s limit.trials caps ${one ? 'it' : 'them'}; --trials ${VERDICT_MIN_TRIALS} replaces it`
      : `trials: ${VERDICT_MIN_TRIALS}`
  return [
    `${plural(few.length, 'compare')} ${one ? 'runs' : 'run'} ${trials} per cell; below ${VERDICT_MIN_TRIALS} trials a side ${one ? 'its' : 'their'} lift shows only a direction and ${one ? 'its' : 'their'} effort can't be tested (${fix})`,
  ]
}

/** The profile whose `limit.trials` cut a row's trials, from its `trials a → b (profile name)` note. */
const cappedBy = (note: string): string | undefined =>
  /^trials \d+ → \d+ \(profile (.+)\)$/.exec(note)?.[1]

/**
 * One line per compared eval with too few cases for its paired lift to get a verdict: one
 * trial a case can't give more discordant cases than there are cases, and several need as many
 * cases, so more trials don't help. `rows` are those that plan a lift.
 */
function familyHints(rows: PlanRow[]): string[] {
  const cases = new Map<string, { n: number; of: number }>()
  for (const r of rows) {
    if (!r.family || !pooledCase(r)) continue
    const c = cases.get(r.family.id) ?? { n: 0, of: r.family.cases }
    cases.set(r.family.id, { ...c, n: c.n + 1 })
  }
  return [...cases]
    .filter(([, { n }]) => n < PAIRED_MIN)
    .map(([id, { n, of }]) => {
      const has = n === of ? `has ${plural(n, 'case')}` : `runs ${n} of its ${of} cases`
      const fix = of >= PAIRED_MIN ? 'run all its cases' : 'add cases'
      return `${clip(id, 64)} ${has}; its lift needs ${PAIRED_MIN} to hold, so it shows only a direction whatever the trials (${fix})`
    })
}

/** One line per harness whose cells fell past the first entries of the `gateway` list. */
function gatewayHints(planned: PlannedItem[]): string[] {
  const hints = new Set<string>()
  for (const { trial } of planned) {
    if (trial.skip || trial.plan.skip || !trial.gateway?.skipped.length) continue
    hints.add(fallbackHint(trial.cell.harness, trial.gateway))
  }
  return [...hints]
}

/**
 * `plan  profile pr (auto: CI is set) · 3 evals · 4 cells · 12 trials · ~9m serial · …`, led by
 * `config ../reeval.config.ts` when `config` is given (the config isn't in the current directory).
 */
export function planLine(plan: RunPlan, config?: string, runId?: string): string {
  const parts: string[] = []
  const id = runId ?? plan.runId
  if (id) parts.push(`run ${id}`)
  if (config) parts.push(`config ${config}`)
  if (plan.resume) parts.push('resume')
  if (plan.resume?.retried) parts.push(`retry ${plural(plan.resume.retried, 'errored trial')}`)
  if (plan.profile) parts.push(`profile ${plan.profile.name} (${plan.profile.reason})`)
  const { skipped } = plan
  parts.push(plural(plan.evals, 'eval') + (skipped ? ` (${skipped} skipped)` : ''))
  parts.push(
    plural(plan.cells, 'cell'),
    plan.fewest < plan.trials
      ? `${plan.fewest}–${plan.trials} trials`
      : plural(plan.trials, 'trial'),
  )
  const effort = effortSummary(plan.efforts)
  if (effort) parts.push(effort)
  const serial = `~${formatDuration(plan.estimateMs)} serial`
  const { parallel } = plan
  const capped = parallel < Math.min(plan.concurrency, plan.trials) ? `, ${parallel} at once` : ''
  parts.push(
    parallel > 1
      ? `${serial} (~${formatDuration(plan.estimateMs / parallel)} at concurrency ${plan.concurrency}${capped})`
      : serial,
  )
  const { trials, duration } = plan.budget
  const caps = [
    trials !== undefined
      ? `${plural(trials, 'trial')} ${plan.trials <= trials ? '✓' : '✗'}`
      : '',
    duration !== undefined ? `${duration}` : '',
  ].filter(Boolean)
  if (caps.length) parts.push(`budget ${caps.join(', ')}`)
  return `plan  ${parts.join(' · ')}`
}

/**
 * `effort medium` when every harness runs at one effort, else `efforts medium on 3 harnesses, none
 * on 1`; undefined when only the fake harness runs.
 */
export function effortSummary(efforts: Record<string, string>): string | undefined {
  const on = new Map<string, number>()
  for (const effort of Object.values(efforts)) on.set(effort, (on.get(effort) ?? 0) + 1)
  if (on.size <= 1) return on.size ? `effort ${[...on.keys()][0]}` : undefined
  const counts = [...on].map(([effort, n], i) =>
    i === 0 ? `${effort} on ${plural(n, 'agent', 'agents')}` : `${effort} on ${n}`,
  )
  return `efforts ${counts.join(', ')}`
}

/** {@link planLine}'s facts and the run's setup, for a terminal's run header. */
export function runHeader(
  plan: RunPlan,
  planned: PlannedItem[],
  run: Pick<RunHeader, 'version' | 'runId' | 'dryRun' | 'config' | 'sandboxes' | 'record'> & {
    /** The run's own judge model, null when it has none. */
    judge: string | null
  },
): RunHeader {
  const live = planned.filter((p) => !p.trial.plan.skip)
  const judges = new Set(live.flatMap((p) => (p.trial.judge ? [p.trial.judge.model] : [])))
  if (!judges.size && run.judge !== null) judges.add(run.judge)
  return {
    version: run.version,
    runId: run.runId,
    dryRun: run.dryRun,
    sandboxes: run.sandboxes,
    ...(run.config ? { config: run.config } : {}),
    ...(run.dryRun || !run.record ? {} : { record: run.record }),
    ...(plan.resume?.completed ? { resumed: plan.resume.completed } : {}),
    ...(plan.resume?.retried ? { retried: plan.resume.retried } : {}),
    ...(plan.profile ? { profile: { name: plan.profile.name, reason: plan.profile.reason } } : {}),
    harnesses: plan.harnesses,
    ...(Object.keys(plan.efforts).length ? { efforts: plan.efforts } : {}),
    judges: [...judges],
    files: new Set(live.map((p) => p.file)).size,
    evals: plan.evals,
    skipped: plan.skipped,
    cells: plan.cells,
    trials: plan.trials,
    fewest: plan.fewest,
    budget: {
      ...(plan.budget.trials !== undefined ? { trials: plan.budget.trials } : {}),
      ...(plan.budget.duration !== undefined ? { duration: `${plan.budget.duration}` } : {}),
    },
    estimateMs: plan.estimateMs,
    parallel: plan.parallel,
    concurrency: plan.concurrency,
  }
}

/** `6–10` for a best-of eval's trials, which stop once a majority agrees; else the count. */
function bestOfRange(p: EvalPlan, trials: number): string {
  if (p.bestOf === undefined) return String(trials)
  return `${(trials / p.bestOf) * majorityOf(p.bestOf)}–${trials}`
}

/**
 * The `--dry-run` table: one row per planned eval, then one per placeholder in `todos`. An eval
 * with cases is one row, its cases counted in its notes.
 */
export function planTable(plan: RunPlan, todos: readonly string[] = []): string[] {
  const header = ['eval', 'agents', 'variants', 'trials', 'total', 'target', 'notes']
  const egress = egressByEnvironment(plan.rows.filter((m) => !m.plan.skip))
  const groups = evalUnits(plan.rows).map((members) => ({
    id: (members[0] as PlanRow).family?.id ?? (members[0] as PlanRow).id,
    members,
  }))
  const rows = groups.map(({ id, members }) => {
    const p = (members.find((m) => !m.plan.skip) ?? (members[0] as PlanRow)).plan
    const family = members[0]?.family
    const live = members.filter((m) => !m.plan.skip)
    const trials = live.reduce((sum, m) => sum + m.plan.totalTrials, 0)
    // `where` can leave a case off some harnesses, so the eval runs on as many as its widest case.
    const harnesses = Math.max(p.harnesses, ...live.map((m) => m.plan.harnesses))
    const ran = live.length === family?.cases ? family.cases : `${live.length} of ${family?.cases}`
    const decides = p.variants !== null ? ' · paired lift' : ''
    const pooled = family && family.cases >= 2 ? [`${ran} cases${decides}`] : []
    return [
      clip(id, 64),
      String(harnesses),
      p.variants === null
        ? '—'
        : p.variants.run === p.variants.of
          ? String(p.variants.run)
          : `${p.variants.run} of ${p.variants.of}`,
      p.bestOf !== undefined ? `best of ${p.bestOf}` : String(p.trials),
      bestOfRange(p, family ? trials : p.totalTrials),
      targetLabel(p.target ?? DEFAULT_TARGET),
      [
        live.length === 0 && p.skip ? `skipped: ${p.skip}` : '',
        ...pooled,
        ...p.notes,
        p.brokered.length ? `brokered: ${p.brokered.join('; ')}` : '',
        rowEgress(live, egress),
        p.workspaces.length ? `workspace: ${p.workspaces.join('; ')}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    ]
  })
  for (const id of todos) rows.push([clip(id, 64), '—', '—', '0', '0', '—', 'todo'])
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)))
  const line = (cols: string[]) =>
    cols
      .map((c, i) => (i === cols.length - 1 ? c : c.padEnd(widths[i] ?? 0)))
      .join('  ')
      .trimEnd()
  return [
    line(header),
    ...rows.flatMap((row, i) => {
      const g = groups[i]
      return [
        line(row),
        ...(g ? graderLines(g.members) : []),
        ...(g ? questionLines(g.members, plan.questionModel) : []),
      ]
    }),
    ...egressLines(egress),
  ]
}

/** Each environment's egress policies (the default `proxy` included) and its automatic hosts by harness. */
type EnvironmentEgress = { policies: Set<string>; auto: Map<string, Set<string>> }

function egressByEnvironment(rows: readonly PlanRow[]): Map<string, EnvironmentEgress> {
  const out = new Map<string, EnvironmentEgress>()
  for (const e of rows.flatMap((r) => r.plan.egress)) {
    const env = out.get(e.environment) ?? { policies: new Set(), auto: new Map() }
    out.set(e.environment, env)
    env.policies.add(e.policy)
    const auto = env.auto.get(e.harness) ?? new Set()
    env.auto.set(e.harness, auto)
    for (const host of e.auto) auto.add(host)
  }
  for (const [name, env] of out)
    if (env.policies.size === 1 && env.policies.has('proxy')) out.delete(name)
  return out
}

/**
 * A row's egress note: only for an environment whose policy differs between evals, since
 * {@link egressLines} prints one that doesn't once for the whole plan.
 */
function rowEgress(rows: readonly PlanRow[], egress: Map<string, EnvironmentEgress>): string {
  const varying = rows
    .flatMap((r) => r.plan.egress)
    .filter((e) => (egress.get(e.environment)?.policies.size ?? 0) > 1)
  const policies = [...new Set(varying.map((e) => e.policy))]
  return policies.length ? `egress: ${policies.join('; ')}` : ''
}

/**
 * `egress  lib  allow registry.npmjs.org` once per environment with a restricted policy, then
 * the hosts reeval adds to it, by harness where they differ.
 */
function egressLines(egress: Map<string, EnvironmentEgress>): string[] {
  const label = (name: string) => (name === NO_ENVIRONMENT ? '(no environment)' : name)
  const width = Math.max(0, ...[...egress.keys()].map((n) => label(n).length))
  return [...egress].flatMap(([name, env]) => {
    const policy = env.policies.size === 1 ? [...env.policies][0] : 'set per eval (see its notes)'
    const byHosts = new Map<string, string[]>()
    for (const [harness, hosts] of env.auto) {
      if (!hosts.size) continue
      const key = [...hosts].join(', ')
      byHosts.set(key, [...(byHosts.get(key) ?? []), harness])
    }
    const indent = ' '.repeat('egress  '.length + width + 2)
    const auto = [...byHosts].map(([hosts, harnesses]) =>
      byHosts.size === 1 && harnesses.length === env.auto.size
        ? `${indent}+ auto: ${hosts}`
        : `${indent}+ auto on ${harnesses.join(', ')}: ${hosts}`,
    )
    return [`egress  ${label(name).padEnd(width)}  ${policy}`, ...auto]
  })
}

export type PlanCell = Cell & {
  /** The gateway its harness resolved to; unset when no config, profile or pin names one. */
  gateway?: ResolvedGateway
  gate: CellGate
  minLift?: number
  /**
   * The reasoning effort its harness runs at: the factory's, or `medium` where it sets none and
   * the harness and model take one; null when reeval asks for none, leaving the CLI's own
   * default.
   */
  effort: string | null
  /** With `bestOf`, the most trials the cell runs. */
  trials: number
  /** Set by `trials: { bestOf }`: the cell stops once a majority of this many agree. */
  bestOf?: number
  /** Secrets its trials broker, as `NAME → host, host`. */
  brokered: string[]
  egress: PlannedEgress
  /** The git repository its workspace starts as; unset for an empty workspace. */
  workspace?: { repo: string; ref: string | null; path: string | null }
  /** The paths its environment's `files` write (`directory()`'s included), sorted. */
  files?: string[]
  /** Its environment's plugins: a local one's name and parts, else its source. */
  plugins?: string[]
}

export type PlanEval = {
  id: string
  file: string
  groups: string[]
  name: string
  tags: string[]
  /** Its `revision`; unset when no level sets one. */
  revision?: Revision
  /** Why the eval doesn't run at all, else null. */
  skip: string | null
  /** What passes it, and whether a miss fails the run. */
  target: Target
  notes: string[]
  cells: PlanCell[]
  /** Its questions: pairwise ones answered after the run, the rest after each trial; unset without any. */
  questions?: PlanQuestion[]
  /** What grades each trial, the config's and profile's graders included; unset without any. */
  graders?: PlannedGrader[]
  /**
   * On an eval with `cases`, each case: its key, the cells it runs and why it doesn't run.
   * `cells` above are the eval's over every case, `trials` summed.
   */
  cases?: PlanCase[]
  /** With `cases`, how many the eval declares: more than `cases` when a filter or `where` left some out. */
  caseCount?: number
  /**
   * The environments (and harnesses) `where` left the eval's cases out of; unset when none. The
   * plan's own `excluded` is the evals a filter or `.skip` left out.
   */
  whereExcluded?: ExcludedPair[]
}

/** One case of an eval with `cases` in `reeval run --dry-run --json`. */
export type PlanCase = {
  key: string
  /** Its place in the eval's `cases`, from 0. */
  index: number
  /** Why the case doesn't run (a filter, `.skip`), else null. */
  skip: string | null
  cells: PlanCell[]
  /** The environments (and harnesses) `where` left this case out of; unset when none. */
  whereExcluded?: ExcludedPair[]
  /** The environments `--trait` or a profile's `limit.traits` left this eval's cells out of; unset when none. */
  traitExcluded?: string[]
}

/** A Docker sandbox image the plan needs, and how it's made, as `reeval image build --dry-run` lists it. */
export type PlanImage = {
  id: string
  /** Whose CLI the image carries. */
  harness: string
  evals: number
  stages: Array<{ what: string; ref: string; action: string }>
}

/** `reeval run --dry-run --json`: the plan as one document. */
export type PlanDocument = {
  /** Minted or resumed before the plan was collected. */
  runId?: string
  profile: { name: string; reason: string } | null
  /**
   * Set when `--resume` continues a previous run or `--retry-errors` retries one: the trials
   * it keeps, and how many of the ones it runs ended in an infra error.
   */
  resume?: { runId: string; completed: number; retried?: number }
  /** `trials` at most; `fewest` start whatever the results (fewer when best-of cells may stop early). */
  totals: { evals: number; skipped: number; cells: number; trials: number; fewest: number }
  budget: { trials: number | null; duration: Duration | null; fits: boolean }
  concurrency: number
  estimateMs: number
  /** What the run should cost: token and USD ranges, how they were reached, and each cell's part. */
  cost?: PlanCost
  warnings: string[]
  /** Sandboxes that run as root, with capabilities added back or with host devices, one per level that set them. */
  sandboxWarnings: SandboxWarning[]
  hints: string[]
  evals: PlanEval[]
  excluded: ExcludedEval[]
  images: PlanImage[]
  /**
   * The host files the run reads, sorted by path: project-relative, or absolute outside the
   * project, once per kind it has. `evals` are the evals that read one, empty for the project's
   * own (the config, its `.env` files, lockfiles); `via` the symlink a skill or plugin reached it
   * through; `symlinkTo` what a symlink in a skill or plugin resolves to.
   */
  inputs: PlanInput[]
  /**
   * The host variables the run reads secrets from, sorted, never their values: the harnesses',
   * judges' and `boat()` accounts' keys (every variable that can provide one) and the variables
   * the config's, profile's and trials' secrets read.
   */
  secrets: string[]
  /**
   * The credentials in `secrets` that any one of several variables provides, such as a harness
   * that takes an API key or a subscription token: each list is met when one of its names is set.
   */
  secretChoices?: string[][]
  /**
   * The names in `secrets` that the cloud platform sets on the machine a cloud run runs on, and
   * nothing else in the run reads, so a cloud run's bundle leaves them out.
   */
  cloudSets?: string[]
  /** Why the cloud platform can't run the plan, with the evals each reason holds back. */
  notCloud?: string[]
  /** Set when the run asked for the cloud platform: where it goes, and why when that's here. */
  target?: { kind: 'cloud' } | { kind: 'local'; why: string }
}

/** One entry in the plan's `inputs`. */
export type PlanInput = {
  path: string
  kind: LocalInputKind
  evals: string[]
  via?: string
  symlinkTo?: string
}

/**
 * The plan's `inputs`: the project's, then each planned trial's, one entry per path and kind,
 * so a path with two roles (a loaded `.env` that `file()` also places) is listed under both. A
 * `read` is listed only for a path that has no other kind: it's the load reading a file the
 * environment names.
 */
export function planInputs(
  root: string,
  project: readonly LocalInput[],
  planned: readonly PlannedItem[],
): PlanInput[] {
  const byPath = new Map<string, PlanInput[]>()
  const add = (input: LocalInput, id?: string) => {
    const path = inputPath(root, input.path)
    const entries = byPath.get(path) ?? []
    byPath.set(path, entries)
    let entry = entries.find((e) => e.kind === input.kind)
    if (!entry && input.kind === 'read') entry = entries[0]
    if (!entry && entries[0]?.kind === 'read' && entries.length === 1) {
      entry = entries[0]
      entry.kind = input.kind
    }
    if (!entry) {
      entry = { path, kind: input.kind, evals: [] }
      entries.push(entry)
    }
    if (input.via && !entry.via) entry.via = inputPath(root, input.via)
    if (input.symlinkTo && !entry.symlinkTo) entry.symlinkTo = inputPath(root, input.symlinkTo)
    if (id !== undefined && !entry.evals.includes(id)) entry.evals.push(id)
  }
  for (const input of project) add(input)
  for (const { id, trial } of planned) for (const input of trial.inputs ?? []) add(input, id)
  const order = (a: PlanInput, b: PlanInput) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0
  return [...byPath.values()].flat().sort(order)
}

export function planDocument(
  plan: RunPlan,
  planned: PlannedItem[],
  excluded: ExcludedEval[],
  images: PlanImage[],
  inputs: PlanInput[] = [],
  secrets: string[] = [],
): PlanDocument {
  const evals = new Map<string, PlanEval & { family?: FamilyMeta }>()
  for (const { id, file, trial } of planned) {
    let e = evals.get(id)
    if (!e) {
      const questions = planQuestions(
        trial.plan.questions,
        plan.rows.find((r) => r.id === id)?.sides ?? [],
        plan.questionModel,
        trial.plan.skip,
      )
      const target = trial.plan.target ?? DEFAULT_TARGET
      // `metric` is only ever an older record's target; a run never plans it.
      if (target.kind === 'metric') throw new Error(`${id} planned a metric target`)
      e = {
        id,
        file,
        groups: trial.groups,
        name: trial.name,
        tags: trial.tags,
        ...(trial.revision !== undefined ? { revision: trial.revision } : {}),
        skip: trial.plan.skip ?? null,
        target,
        notes: trial.plan.notes,
        cells: [],
        ...(questions.length ? { questions } : {}),
        ...(trial.plan.graders ? { graders: trial.plan.graders } : {}),
        ...(trial.family ? { family: trial.family } : {}),
        ...(trial.plan.excluded ? { whereExcluded: trial.plan.excluded } : {}),
        ...(trial.plan.traitExcluded ? { traitExcluded: trial.plan.traitExcluded } : {}),
      }
      evals.set(id, e)
    }
    if (trial.skip || trial.plan.skip) continue
    const cell = e.cells.find((c) => c.key === trial.cell.key)
    if (cell) cell.trials++
    else {
      e.cells.push({
        ...trial.cell,
        ...(trial.gateway ? { gateway: trial.gateway } : {}),
        gate: trial.gate,
        ...(trial.minLift !== undefined ? { minLift: trial.minLift } : {}),
        effort: harnessEffort(trial.harness) ?? null,
        trials: 1,
        ...(trial.bestOf !== undefined ? { bestOf: trial.bestOf } : {}),
        brokered: trial.brokered,
        egress: trial.egress,
        ...(trial.workspace && {
          workspace: {
            repo: trial.workspace.repo,
            ref: trial.workspace.ref ?? null,
            path: trial.workspace.path ?? null,
          },
        }),
        ...(trial.files && { files: trial.files }),
        ...(trial.plugins && { plugins: trial.plugins }),
      })
    }
  }
  const { trials, duration } = plan.budget
  return {
    ...(plan.runId ? { runId: plan.runId } : {}),
    profile: plan.profile && { name: plan.profile.name, reason: plan.profile.reason },
    ...(plan.resume ? { resume: plan.resume } : {}),
    totals: {
      evals: plan.evals,
      skipped: plan.skipped,
      cells: plan.cells,
      trials: plan.trials,
      fewest: plan.fewest,
    },
    budget: {
      trials: trials ?? null,
      duration: duration ?? null,
      fits: trials === undefined || plan.trials <= trials,
    },
    concurrency: plan.concurrency,
    estimateMs: plan.estimateMs,
    ...(plan.cost ? { cost: plan.cost } : {}),
    warnings: plan.warnings,
    sandboxWarnings: plan.sandboxWarnings,
    hints: plan.hints,
    evals: foldPlanCases([...evals.values()], planned),
    excluded,
    images,
    inputs,
    secrets,
  }
}

/** Each eval with `cases` as one entry, at its first case's place, its cases inside it. */
function foldPlanCases(
  evals: Array<PlanEval & { family?: FamilyMeta }>,
  planned: PlannedItem[],
): PlanEval[] {
  const pooledExcluded = new Map<string, ExcludedPair[]>()
  for (const { trial } of planned) {
    const f = trial.family
    if (f && trial.plan.familyExcluded) pooledExcluded.set(f.id, trial.plan.familyExcluded)
  }
  const out: PlanEval[] = []
  const folded = new Map<string, PlanEval>()
  for (const { family, ...e } of evals) {
    if (!family) {
      out.push(e)
      continue
    }
    let into = folded.get(family.id)
    if (!into) {
      const excluded = pooledExcluded.get(family.id)
      into = {
        ...e,
        id: family.id,
        name: family.name,
        cells: [],
        cases: [],
        caseCount: family.cases,
        ...(excluded?.length ? { whereExcluded: excluded } : {}),
      }
      if (!excluded?.length) delete into.whereExcluded
      folded.set(family.id, into)
      out.push(into)
    }
    into.cases?.push({
      key: caseKeyOf(family.name, e.name),
      index: family.case,
      skip: e.skip,
      cells: e.cells,
      ...(e.whereExcluded ? { whereExcluded: e.whereExcluded } : {}),
    })
    if (!e.skip) into.skip = null
    for (const c of e.cells) {
      const cell = into.cells.find((x) => x.key === c.key)
      if (cell) cell.trials += c.trials
      else into.cells.push({ ...c })
    }
  }
  return out
}

/** Exit 2 before anything starts when the plan is over `budget.trials` (unless `--force`). */
export function checkTrialBudget(plan: RunPlan, force: boolean, configFile: string): void {
  const cap = plan.budget.trials
  if (cap === undefined || plan.trials <= cap || force) return
  const where = plan.profile ? `profile ${plan.profile.name}` : configFile
  throw new UsageError(
    `this run plans ${plan.trials} trials, over budget.trials ${cap} (${where}). Narrow it with --tag or --trials, or raise the budget. (--force runs it anyway)`,
  )
}
