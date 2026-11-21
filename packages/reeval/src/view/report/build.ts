import { caseName } from '../../history/cases.ts'
import type { AttemptRecord, CellRecord, EvalEntry, RunRecord } from '../../history/types.ts'
import {
  COMPARE_RUNS,
  containsZero,
  liftInterval,
  passKAcrossTasks,
  SMALL_CERTAINTY_N,
  type TaskTrialInput,
  taskMeanRate,
} from '../../stats.ts'
import { plural } from '../../text.ts'
import type { CapturePageFile, PassMetric, PassMetricLead } from '../../types.ts'
import { totalTokens } from '../../usage.ts'
import type { AnalysisDoc } from '../analysis.ts'
import type { AttemptFacts } from '../classify.ts'
import type { CompareRow, StackChange } from '../compare.ts'
import { contrastsOf } from '../contrasts.ts'
import { runCost } from '../cost.ts'
import { costPerSuccess, effortSample, filesChanged, formatCount } from '../effort.ts'
import { caseLabel } from '../family.ts'
import { checksByLabel, checkTries, labeledJudgments } from '../judgments.ts'
import { attemptAnswerRows, isUngatedMiss, notRunYet } from '../model.ts'
import { observedLine, observedTallies } from '../observations.ts'
import type { RunRemarks } from '../remarks.ts'
import { runScope } from '../scope.ts'
import { factSegment, messageLine } from '../suite.ts'
import { turnErrorKind } from '../turn-error.ts'
import {
  countFigure,
  countOf,
  diffLinesText,
  durationFigure,
  headlineResultText,
  MEASURE_TEXT,
  pctDelta,
  percentFigure,
  proportion,
  proportionText,
  ptsDelta,
  ptsInterval,
  rateOf,
  remarkLine,
  remarkLocation,
  spreadOf,
  tokensFigure,
  tokensText,
  usdFigure,
  wilsonRangeText,
} from './format.ts'
import { type AttemptIdMap, attemptIds, ranAttempt, selectedEvals } from './ids.ts'
import { PASS_RATE_OUTCOME_LABEL, passRateOutcomeFromMatchers } from './labels.ts'
import { attemptHref, attemptRef, captureHref, gfmAnchor, withBase } from './links.ts'
import { REPORT_POLICY } from './policy.ts'
import { provenanceState } from './provenance.ts'
import type {
  Arm,
  ArmRef,
  ArmRow,
  AssertionRow,
  AttemptIndexRow,
  AttemptRef,
  BreakdownRow,
  CaptureGallery,
  ChangeRow,
  CheckCell,
  ChoiceBreakdown,
  ContrastRow,
  DiscoveryRate,
  EvalHeadline,
  EvalSection,
  EvalShape,
  ExecutiveRollup,
  FailureClusters,
  Fairness,
  Figure,
  HeadlinePrimary,
  HeadlineResult,
  IntegrityIssue,
  JudgeScore,
  JudgmentBreakdown,
  MeasureCells,
  MeasureKey,
  MeasureVsBaseline,
  NextStep,
  Proportion,
  QualitativeAnswers,
  Quote,
  Rate,
  RegressionChanges,
  ReportClaim,
  RosterRow,
  RunHeader,
  RunReport,
  RunTally,
  Spread,
  TaskCell,
  TaskResults,
  TaskRow,
  VariantComparison,
} from './types.ts'

export type RunReportOptions = {
  remarks?: RunRemarks | null
  analysis?: AnalysisDoc | null
  /** `.capture.json` files read beside the record, by `ArtifactRef.capture.page.path`. */
  pages?: ReadonlyMap<string, CapturePageFile>
  /**
   * Each attempt's facts from its kept transcript (`attemptFacts`), by `AttemptRecord.key`; an
   * attempt with none has none in the report.
   */
  facts?: ReadonlyMap<string, AttemptFacts>
  prior?: { record: RunRecord; rows: CompareRow[]; changes: StackChange[] } | null
  /** Limits the report to these `EvalEntry.key`s; one key gives a single-eval report. */
  evals?: string[]
  /** Overrides the derived title. */
  title?: string
  /** Explicit pass/fail metric override (e.g. `'task-pass-rate'` or `{ passAtK: 3 }`). */
  metric?: PassMetric
  /** Where the report's links point. */
  links?: ReportLinks
}

/** Where a report's links point, for a host that serves a run's files elsewhere than its folder. */
export type ReportLinks = {
  /**
   * Where the run's folder is, which every artifact link is relative to: a path or URL, read as a
   * folder whether or not it ends in `/`. `./` in `summary.md`. A base with a query string or
   * fragment, such as a signed URL, isn't supported: a host that needs one rewrites each link.
   */
  base?: string
  /** The run record's href. `../<runId>.json`, the record beside the run's folder, by default. */
  record?: string
}

const MEASURE_KEYS: MeasureKey[] = [
  'tokens',
  'toolCalls',
  'turns',
  'costUsd',
  'agentMs',
  'filesChanged',
  'linesAdded',
  'linesRemoved',
]

const LOCKFILE_NAMES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'pubspec.lock',
  'Cargo.lock',
  'go.sum',
  'poetry.lock',
  'uv.lock',
  'Pipfile.lock',
  'Gemfile.lock',
  'composer.lock',
  'Podfile.lock',
  'gradle.lockfile',
])

const isLockfilePath = (path: string) => LOCKFILE_NAMES.has(path.split('/').pop() ?? path)

const countedOutcome = (o: AttemptRecord['outcome']) => o === 'pass' || o === 'fail'

const cellOf = (e: EvalEntry, key: string) => e.cells.find((c) => c.key === key)

function assignAttemptHrefs(ctx: Ctx): void {
  for (const e of ctx.evals) {
    for (const a of e.attempts) {
      if (!ranAttempt(a)) continue
      const id = ctx.ids.get(a.key)
      if (!id) continue
      const href = attemptHref(e, a, ctx.linkBase, ctx.hrefs)
      ctx.hrefByKey.set(a.key, href)
    }
  }
}

const repoBasename = (remote: string | null | undefined): string | null => {
  if (!remote) return null
  const cleaned = remote.replace(/\.git$/, '')
  const slash = cleaned.lastIndexOf('/')
  const colon = cleaned.lastIndexOf(':')
  const at = Math.max(slash, colon)
  return at === -1 ? cleaned : cleaned.slice(at + 1) || null
}

function emptyMeasures(): MeasureCells {
  return {
    tokens: null,
    toolCalls: null,
    turns: null,
    costUsd: null,
    agentMs: null,
    filesChanged: null,
    linesAdded: null,
    linesRemoved: null,
  }
}

function emptyMeasureVsBaseline(): Record<MeasureKey, MeasureVsBaseline> {
  const blank = (): MeasureVsBaseline => ({ value: null, delta: null, lower: null })
  return {
    tokens: blank(),
    toolCalls: blank(),
    turns: blank(),
    costUsd: blank(),
    agentMs: blank(),
    filesChanged: blank(),
    linesAdded: blank(),
    linesRemoved: blank(),
  }
}

/** Diff line totals for an attempt; lockfiles excluded. Null counts when not recorded. */
function attemptDiffStats(a: AttemptRecord): {
  files: number
  added: number | null
  removed: number | null
} {
  const files = filesChanged(a.changedFiles)
  const withLines = a.changedFiles.filter((f) => {
    const row = f as { added?: number; removed?: number; lockfile?: boolean }
    return (
      !isLockfilePath(f.path) &&
      !row.lockfile &&
      (row.added !== undefined || row.removed !== undefined)
    )
  })
  if (withLines.length === 0) {
    // Older records: no per-file line stats on changedFiles.
    return { files, added: null, removed: null }
  }
  let added = 0
  let removed = 0
  for (const f of a.changedFiles) {
    const row = f as { added?: number; removed?: number; lockfile?: boolean }
    if (isLockfilePath(f.path) || row.lockfile) continue
    added += row.added ?? 0
    removed += row.removed ?? 0
  }
  return { files, added, removed }
}

function measureValues(
  attempts: AttemptRecord[],
  passingOnly = false,
): Record<MeasureKey, number[]> {
  const out: Record<MeasureKey, number[]> = {
    tokens: [],
    toolCalls: [],
    turns: [],
    costUsd: [],
    agentMs: [],
    filesChanged: [],
    linesAdded: [],
    linesRemoved: [],
  }
  for (const a of attempts) {
    if (passingOnly ? a.outcome !== 'pass' : !countedOutcome(a.outcome)) continue
    const sample = effortSample(a)
    if (sample.tokens !== undefined) out.tokens.push(sample.tokens)
    out.toolCalls.push(sample.tools)
    out.turns.push(a.turns.length)
    if (sample.usd !== undefined) out.costUsd.push(sample.usd)
    out.agentMs.push(sample.agentMs)
    out.filesChanged.push(sample.filesChanged)
    const diff = attemptDiffStats(a)
    if (diff.added !== null) out.linesAdded.push(diff.added)
    if (diff.removed !== null) out.linesRemoved.push(diff.removed)
  }
  return out
}

function measuresOf(attempts: AttemptRecord[], passingOnly = false): MeasureCells {
  const values = measureValues(attempts, passingOnly)
  const cells = emptyMeasures()
  for (const key of MEASURE_KEYS) {
    cells[key] = spreadOf(values[key], MEASURE_TEXT[key])
  }
  return cells
}

function measureVs(
  value: Spread | null,
  baseline: Spread | null,
  lower: { k: number; n: number } | null,
): MeasureVsBaseline {
  if (!value) return { value: null, delta: null, lower: null }
  const delta =
    baseline && baseline.median.value !== null && value.median.value !== null
      ? pctDelta(value.median.value, baseline.median.value)
      : null
  return {
    value,
    delta,
    lower: lower ? countOf(lower.k, lower.n) : null,
  }
}

type Ctx = {
  record: RunRecord
  evals: EvalEntry[]
  ids: AttemptIdMap
  linkBase?: string
  remarks: RunRemarks | null
  analysis: AnalysisDoc | null
  pages?: ReadonlyMap<string, CapturePageFile>
  facts?: ReadonlyMap<string, AttemptFacts>
  prior: RunReportOptions['prior']
  metric?: PassMetric
  /** Citation hrefs already claimed in this report; keeps per-arm evidence distinct. */
  hrefs: Set<string>
  /** Canonical evidence href per attempt key, assigned before section cites. */
  hrefByKey: Map<string, string>
}

function deriveTally(evals: EvalEntry[]): RunTally {
  let passed = 0
  let failed = 0
  let ungatedPassed = 0
  let ungatedFailed = 0
  let infraError = 0
  let reclassified = 0
  let skipped = 0
  for (const e of evals) {
    for (const a of e.attempts) {
      const cell = cellOf(e, a.cell)
      const ungated = cell?.gate === 'none'
      if (a.outcome === 'skipped') {
        skipped++
        continue
      }
      if (a.outcome === 'infra_error') {
        infraError++
        if (wasReclassified(a)) reclassified++
        continue
      }
      if (a.outcome === 'pass') {
        if (ungated) ungatedPassed++
        else passed++
        continue
      }
      if (a.outcome === 'fail') {
        if (ungated || isUngatedMiss(e, a)) ungatedFailed++
        else failed++
      }
    }
  }
  return {
    counted: passed + failed,
    passed,
    failed,
    ungated: { passed: ungatedPassed, failed: ungatedFailed },
    infraError,
    reclassified,
    skipped,
  }
}

/** Older records: a turn error on a pass/fail attempt is treated as reclassified. */
function wasReclassified(a: AttemptRecord): boolean {
  if ((a as { turnStatusRead?: boolean }).turnStatusRead === true) return false
  if (a.error && 'turn' in a.error && (a.error as { turn?: unknown }).turn) return true
  return a.turns.some((t) => t.status === 'error') && countedOutcome(a.outcome)
}

/** An attempt's outcome as the index shows it: a fail an interrupted run aborted is `canceled`. */
function indexOutcome(a: AttemptRecord, record: RunRecord): AttemptIndexRow['outcome'] {
  if (a.outcome === 'fail' && a.error?.kind === 'aborted' && record.status === 'interrupted') {
    return 'canceled'
  }
  return a.outcome as AttemptIndexRow['outcome']
}

function turnErrorMessage(a: AttemptRecord): string | null {
  const turn = a.turns.find((t) => t.status === 'error' && t.error)
  if (!turn?.error) return null
  return `${turnErrorKind(turn.error)}: ${messageLine(turn.error)}`
}

function runTitle(record: RunRecord, evals: EvalEntry[], title?: string): string {
  if (title) return title
  if (evals.length === 1) return evals[0]!.name
  const groups = evals.map((e) => e.group[0]).filter(Boolean)
  if (groups.length === evals.length && new Set(groups).size === 1) return groups[0] as string
  return `Run ${record.runId}`
}

function runsPerCell(evals: EvalEntry[]): number | null {
  const runs = new Set(evals.flatMap((e) => e.cells.map((c) => c.runs)))
  return runs.size === 1 ? ([...runs][0] ?? null) : null
}

function buildHeader(ctx: Ctx): RunHeader {
  const { record, evals } = ctx
  const tally = deriveTally(evals)
  const usageAttempts = evals.flatMap((e) => e.attempts).filter((a) => a.usage)
  let total: number | null = null
  let cacheRead: number | null = null
  if (usageAttempts.length) {
    total = 0
    cacheRead = 0
    for (const a of usageAttempts) {
      if (!a.usage) continue
      total += totalTokens(a.usage)
      cacheRead += a.usage.cacheRead
    }
  }
  const cost = runCost(record.cost)
  const agent = record.cost?.agentUsd
  const judge = record.cost?.judgeUsd
  const unpriced = (agent?.unpriced ?? 0) + (judge?.unpriced ?? 0)
  let basis: 'reported' | 'estimated' | 'mixed' | null = null
  if (agent || judge) {
    const bases = [agent?.basis, judge?.basis].filter(Boolean)
    basis = bases.every((b) => b === 'reported')
      ? 'reported'
      : bases.every((b) => b === 'estimated')
        ? 'estimated'
        : 'mixed'
  }
  return {
    title: runTitle(record, evals),
    status: record.status,
    startedAt: record.startedAt,
    author: record.author,
    reeval: record.stack.reeval,
    profile: record.profile?.name ?? null,
    scope: runScope(record),
    runsPerCell: runsPerCell(evals),
    wall: durationFigure(record.durationMs),
    tally,
    tokens:
      total === null ? null : { total: tokensFigure(total), cacheRead: tokensFigure(cacheRead) },
    cost: basis
      ? {
          agent: agent ? usdFigure(agent.usd) : null,
          judge: judge ? usdFigure(judge.usd) : null,
          total: agent && judge ? usdFigure(agent.usd + judge.usd) : null,
          basis,
          ...(unpriced ? { unpriced } : {}),
        }
      : cost
        ? {
            agent: null,
            judge: null,
            total: usdFigure(cost.usd),
            basis: cost.basis === 'reported' ? 'reported' : 'estimated',
          }
        : null,
    git: record.git
      ? {
          sha: record.git.sha,
          branch: record.git.branch,
          dirty: record.git.dirty,
          repo: repoBasename(record.git.remote),
        }
      : null,
    ...(servedBy(evals).length ? { servedBy: servedBy(evals) } : {}),
    ...(record.errors?.length ? { errors: record.errors.map(messageLine) } : {}),
  }
}

/** Which upstream providers a gateway said served each harness's calls and its judge's. */
function servedBy(evals: EvalEntry[]): Array<{ harness: string; text: string }> {
  const by = new Map<string, { agent: Map<string, number>; judge: Map<string, number> }>()
  const add = (m: Map<string, number>, provider: string, calls: number) =>
    m.set(provider, (m.get(provider) ?? 0) + calls)
  for (const e of evals) {
    for (const a of e.attempts) {
      const harness = cellOf(e, a.cell)?.harness
      if (!harness) continue
      const seen = by.get(harness) ?? { agent: new Map(), judge: new Map() }
      for (const u of a.upstreams ?? []) add(seen.agent, u.provider, u.calls)
      for (const j of a.judgements) if (j.upstream) add(seen.judge, j.upstream, 1)
      by.set(harness, seen)
    }
  }
  const list = (m: Map<string, number>) => [...m].map(([p, n]) => `${p} ${n}`).join(' · ')
  return [...by].flatMap(([harness, { agent, judge }]) => {
    const parts = [
      ...(agent.size ? [`served by ${list(agent)}`] : []),
      ...(judge.size ? [`judge served by ${list(judge)}`] : []),
    ]
    return parts.length ? [{ harness, text: parts.join('; ') }] : []
  })
}

function uniqueEvalNames(evals: EvalEntry[]): Map<string, string> {
  const counts = new Map<string, number>()
  for (const e of evals) counts.set(e.name, (counts.get(e.name) ?? 0) + 1)
  const out = new Map<string, string>()
  for (const e of evals) {
    out.set(e.key, (counts.get(e.name) ?? 0) > 1 ? `${e.name} (${e.file})` : e.name)
  }
  return out
}

function shapesOf(e: EvalEntry, prior: boolean): EvalShape[] {
  const shapes: EvalShape[] = []
  if (prior) shapes.push('regression')
  if (e.compare) shapes.push('ab')
  const discovery = e.attempts.some((a) =>
    (a.assertions ?? []).some((x) =>
      /toHaveCalledSkill|toHaveFetched|toHaveCalledMcp|toHaveReadSkill/i.test(x.matcher),
    ),
  )
  if (discovery) shapes.push('discoverability')
  if (!e.compare && !prior) shapes.push('task')
  return shapes.length ? shapes : ['task']
}

function designOf(e: EvalEntry): string {
  const harnesses = new Set(e.cells.map((c) => c.harness)).size
  const arms = new Set(e.cells.map((c) => c.environment)).size
  const prompts = new Set(
    e.attempts.flatMap((a) => (a.turns[0]?.prompt ? [a.turns[0].prompt] : [])),
  ).size
  const attempts = e.attempts.filter(ranAttempt).length
  const parts: string[] = []
  if (prompts > 1) parts.push(`${prompts} prompts`)
  parts.push(`${harnesses} coding harness${harnesses === 1 ? '' : 'es'}`)
  if (arms > 1) parts.push(`${arms} arms`)
  parts.push(`${attempts} attempt${attempts === 1 ? '' : 's'}`)
  return parts.join(', ')
}

function assertionLabels(
  e: EvalEntry,
): Array<{ label: string; matcher: string; at: string | null }> {
  const seen = new Map<string, { label: string; matcher: string; at: string | null }>()
  for (const a of e.attempts) {
    for (const x of a.assertions ?? []) {
      if (seen.has(x.label)) continue
      // Skip not_applicable-only labels later via check cells.
      seen.set(x.label, { label: x.label, matcher: x.matcher, at: x.at ?? null })
    }
  }
  return [...seen.values()]
}

function checkCellOf(attempts: AttemptRecord[], label: string): CheckCell {
  let passed = 0
  let failed = 0
  let errored = 0
  let notApplicable = 0
  let preSatisfied = 0
  let notRun = 0
  let reached = 0
  let reason: string | null = null
  for (const a of attempts) {
    if (!countedOutcome(a.outcome) && a.outcome !== 'infra_error') continue
    const hit = (a.assertions ?? []).find((x) => x.label === label)
    if (!hit) {
      notRun++
      continue
    }
    reached++
    const status = hit.status as string
    if (status === 'not_applicable') {
      notApplicable++
      if (!reason && hit.reason) reason = hit.reason
      continue
    }
    if (hit.preSatisfied) preSatisfied++
    if (status === 'pass') passed++
    else if (status === 'fail') failed++
    else if (status === 'error') errored++
  }
  const answered = passed + failed
  if (reached === 0 || (answered === 0 && notApplicable > 0 && errored === 0)) {
    const na = reason ? `n/a (${reason})` : 'n/a'
    return {
      status: reached === 0 ? 'not-run' : 'na',
      passed: 0,
      answered: 0,
      notApplicable,
      preSatisfied,
      text: reached === 0 ? 'n/a' : na,
      reason: reached === 0 ? null : reason,
    }
  }
  if (errored && answered === 0) {
    return {
      status: 'error',
      passed,
      answered,
      notApplicable,
      preSatisfied,
      text: `${errored} error${errored === 1 ? '' : 's'}`,
      reason: null,
    }
  }
  const status: CheckCell['status'] =
    answered === 0 ? 'na' : failed === 0 && errored === 0 ? 'pass' : passed === 0 ? 'fail' : 'mixed'
  const base = answered === 0 ? (reason ? `n/a (${reason})` : 'n/a') : `${passed} of ${answered}`
  const text = preSatisfied > 0 ? `${base}, ${preSatisfied} pre-satisfied` : base
  return {
    status,
    passed,
    answered,
    notApplicable,
    preSatisfied,
    text,
    reason: status === 'na' ? reason : null,
  }
}

function passRateForAttempts(attempts: AttemptRecord[]): Rate {
  const counted = attempts.filter((a) => countedOutcome(a.outcome))
  const passed = counted.filter((a) => a.outcome === 'pass').length
  return rateOf(passed, counted.length)
}

function armLabel(cell: CellRecord, digestClash: boolean): string {
  if (cell.role === 'control') return cell.environment
  const name = cell.variant ?? cell.environment
  if (!digestClash || !cell.environmentDigest) return name
  return `${name} (${cell.environmentDigest.replace(/^sha256:/, '').slice(0, 7)})`
}

function armsOf(e: EvalEntry): Arm[] {
  const byEnv = new Map<string, CellRecord[]>()
  for (const c of e.cells) {
    const list = byEnv.get(c.environment) ?? []
    list.push(c)
    byEnv.set(c.environment, list)
  }
  const digestClash = [...byEnv.values()].some((cells) => {
    const digests = new Set(cells.map((c) => c.environmentDigest ?? c.environment))
    return digests.size > 1
  })
  // One arm per environment (control first), using a representative cell.
  const controls = e.cells.filter((c) => c.role === 'control')
  const variants = e.cells.filter((c) => c.role === 'variant')
  const order: CellRecord[] = []
  const seen = new Set<string>()
  for (const c of [...controls, ...variants]) {
    const key = c.environmentDigest ?? c.environment
    if (seen.has(key)) continue
    seen.add(key)
    order.push(c)
  }
  return order.map((c) => {
    const attempts = e.attempts.filter(
      (a) => cellOf(e, a.cell)?.environment === c.environment && countedOutcome(a.outcome),
    )
    const prompts = [
      ...new Set(
        attempts.flatMap((a) => {
          const p = a.turns[0]?.prompt
          return p ? [p] : []
        }),
      ),
    ]
    return {
      id: c.environmentDigest ?? c.environment,
      label: armLabel(c, digestClash),
      environment: c.environment,
      environmentDigest: c.environmentDigest,
      role: c.role === 'control' ? 'baseline' : 'variant',
      change: c.role === 'variant' ? (c.variant ?? c.environment) : null,
      prompts: prompts.map((p) => {
        // Content hash stand-in: first 12 chars of a simple digest of the prompt text length+prefix.
        let h = 0
        for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) | 0
        return `p${(h >>> 0).toString(16).padStart(8, '0')}`
      }),
      gated: e.cells
        .filter(
          (x) => (x.environmentDigest ?? x.environment) === (c.environmentDigest ?? c.environment),
        )
        .every((x) => x.gate !== 'none'),
    }
  })
}

function fairnessOf(nA: number, nB: number, interval: { lo: number; hi: number } | null): Fairness {
  if (Math.min(nA, nB) < COMPARE_RUNS) return 'too-few-runs'
  if (interval && containsZero(interval.lo, interval.hi)) return 'within-noise'
  return 'clear'
}

const SATURATION_NOTE =
  'Saturated: every arm hit 100% across all tasks. This comparison catches regressions; add harder tasks to separate variants.'

type ResolvedMetric = {
  lead: PassMetricLead
  k: number | null
  configured: boolean
}

function resolveMetric(e: EvalEntry, record: RunRecord, override?: PassMetric): ResolvedMetric {
  const raw = override ?? e.metric ?? record.profile?.defaults.metric ?? record.config.metric
  if (raw === undefined) return { lead: 'pass-rate', k: null, configured: false }
  if (raw === 'pass-rate') return { lead: 'pass-rate', k: null, configured: true }
  if (raw === 'task-pass-rate') return { lead: 'task-pass-rate', k: null, configured: true }
  if ('passAtK' in raw) return { lead: 'pass@k', k: raw.passAtK, configured: true }
  if ('passHatK' in raw) return { lead: 'pass^k', k: raw.passHatK, configured: true }
  return { lead: raw.lead ?? 'pass-rate', k: raw.k, configured: true }
}

function isPassFailEval(e: EvalEntry): boolean {
  if (assertionLabels(e).length > 0) return true
  if (!e.compare) return false
  if (e.attempts.some((a) => a.outcome === 'fail')) return true
  const hasUngradedSignals =
    attemptAnswerRows(e).length > 0 ||
    e.attempts.some((a) => (a.judgements?.length ?? 0) > 0 || (a.observations?.length ?? 0) > 0)
  return e.cells.some((c) => c.gate !== 'none') && !hasUngradedSignals
}

type EvalTask = {
  task: string
  label: string
  match: (a: AttemptRecord) => boolean
}

/**
 * Tasks in an `EvalEntry`: reuses `EvalEntry.cases` (`CaseRecord`) and `caseLabel` when `cases`
 * exist, else falls back to distinct first-turn prompts when a cell ran multiple distinct prompts.
 */
function evalTasks(e: EvalEntry): EvalTask[] {
  const caseMap = new Map<string, string>()
  for (const c of e.cases ?? []) {
    const label = c.name ? caseLabel(e.name, c.name) : c.key
    caseMap.set(c.key, label)
  }
  for (const a of e.attempts) {
    if (a.case !== undefined && !caseMap.has(a.case)) {
      caseMap.set(a.case, a.case)
    }
  }
  if (caseMap.size > 0) {
    return [...caseMap.entries()].map(([task, label]) => ({
      task,
      label,
      match: (a) => a.case === task,
    }))
  }
  const byCell = new Map<string, Set<string>>()
  const allPrompts: string[] = []
  for (const a of e.attempts) {
    const prompt = a.turns[0]?.prompt?.trim()
    if (!prompt) continue
    if (!allPrompts.includes(prompt)) allPrompts.push(prompt)
    const set = byCell.get(a.cell) ?? new Set<string>()
    set.add(prompt)
    byCell.set(a.cell, set)
  }
  const multiPromptInCell = [...byCell.values()].some((s) => s.size > 1)
  if (multiPromptInCell && allPrompts.length > 1) {
    return allPrompts.map((prompt, idx) => {
      const oneLine = prompt.replace(/\s+/g, ' ').trim()
      const label = oneLine.length > 60 ? `${oneLine.slice(0, 59)}…` : oneLine
      return {
        task: `prompt-${idx + 1}`,
        label,
        match: (a) => a.turns[0]?.prompt?.trim() === prompt,
      }
    })
  }
  return [{ task: 'default', label: e.name, match: () => true }]
}

type ScopeScore = {
  taskRate?: Figure
  rawTaskRate: number | null
  k?: number
  passAtK?: Figure
  rawPassAtK?: number
  passHatK?: Figure
  rawPassHatK?: number
  passKOmitted?: string
}

function isExcludedForTask(e: EvalEntry, taskKey: string, cell: CellRecord): boolean {
  return (e.excluded ?? []).some(
    (ex) =>
      ex.case === taskKey &&
      ex.environment === cell.environment &&
      (ex.harness === undefined || ex.harness === cell.harness),
  )
}

function scoreScope(
  e: EvalEntry,
  tasks: EvalTask[],
  attempts: AttemptRecord[],
  cells: CellRecord[],
  requestedK: number | null,
): ScopeScore {
  const multi = tasks.length > 1
  const inputs: TaskTrialInput[] = []
  for (const t of tasks) {
    const activeCells = cells.filter((c) => !isExcludedForTask(e, t.task, c))
    if (cells.length > 0 && activeCells.length === 0) continue
    const counted = attempts.filter((a) => countedOutcome(a.outcome) && t.match(a))
    const pass = counted.filter((a) => a.outcome === 'pass').length
    if (activeCells.length > 1) {
      const cellTrials = activeCells.map((c) => {
        const ca = counted.filter((a) => a.cell === c.key)
        return { pass: ca.filter((a) => a.outcome === 'pass').length, n: ca.length }
      })
      inputs.push({ pass, n: counted.length, cellTrials })
    } else {
      inputs.push({ pass, n: counted.length })
    }
  }
  const rawTaskRate = multi ? taskMeanRate(inputs) : null
  const out: ScopeScore = {
    rawTaskRate,
    ...(multi && rawTaskRate !== null ? { taskRate: percentFigure(rawTaskRate) } : {}),
  }
  if (requestedK !== null) {
    const pk = passKAcrossTasks(inputs, requestedK)
    out.k = pk.k
    if (pk.ok) {
      out.rawPassAtK = pk.passAtK
      out.rawPassHatK = pk.passHatK
      out.passAtK = percentFigure(pk.passAtK)
      out.passHatK = percentFigure(pk.passHatK)
    } else {
      out.passKOmitted = pk.reason
    }
  }
  return out
}

function buildTaskCell(
  attempts: AttemptRecord[],
  cells: CellRecord[],
  requestedK: number | null,
): TaskCell {
  const rate = passRateForAttempts(attempts)
  if (requestedK === null) return { rate }
  const counted = attempts.filter((a) => countedOutcome(a.outcome))
  const cellTrials =
    cells.length > 1
      ? cells.map((c) => {
          const ca = counted.filter((a) => a.cell === c.key)
          return { pass: ca.filter((a) => a.outcome === 'pass').length, n: ca.length }
        })
      : [{ pass: rate.k, n: rate.n }]
  const pk = passKAcrossTasks(
    [{ pass: rate.k, n: rate.n, ...(cells.length > 1 ? { cellTrials } : {}) }],
    requestedK,
  )
  if (pk.ok) {
    return {
      rate,
      k: pk.k,
      passAtK: percentFigure(pk.passAtK),
      passHatK: percentFigure(pk.passHatK),
    }
  }
  return { rate, k: pk.k, passKOmitted: pk.reason }
}

function costReportedOnEval(e: EvalEntry): boolean {
  return e.attempts.some((a) => countedOutcome(a.outcome) && a.cost !== undefined)
}

function trialsText(n: number): string {
  return `${n} trial${n === 1 ? '' : 's'}`
}

function smallCeilingSentence(label: string | null, rate: Rate): string | null {
  if (rate.rate !== 1 || rate.n <= 0 || rate.n >= SMALL_CERTAINTY_N) return null
  const on = label ? ` on ${label}` : ''
  return `No failures in ${trialsText(rate.n)}${on} (95% Wilson CI ${wilsonRangeText(rate.interval)}).`
}

function floorSentence(fairness: Fairness, n: number): string {
  if (fairness === 'too-few-runs') {
    return `${trialsText(n)} per side is below ${COMPARE_RUNS}, so this cannot come back helped or made worse.`
  }
  if (fairness === 'within-noise') return 'The interval spans 0: within noise.'
  return ''
}

function headlineResultOf(primary: HeadlinePrimary): HeadlineResult {
  switch (primary.kind) {
    case 'pass-rate':
      return {
        kind: 'pass-rate',
        passed: proportion(primary.rate),
        outcome: primary.outcome,
        ...(primary.taskRate?.value != null ? { taskRate: primary.taskRate.value } : {}),
        ...(primary.metric ? { metric: primary.metric } : {}),
        ...(primary.k !== undefined ? { k: primary.k } : {}),
        ...(primary.passAtK?.value != null ? { passAtK: primary.passAtK.value } : {}),
        ...(primary.passHatK?.value != null ? { passHatK: primary.passHatK.value } : {}),
      }
    case 'lift':
      return {
        kind: 'lift',
        baseline: primary.baseline.label,
        variant: primary.variant.label,
        baselinePassed: proportion(primary.baselineRate),
        variantPassed: proportion(primary.variantRate),
        ...(primary.baselineTaskRate?.value != null
          ? { baselineTaskRate: primary.baselineTaskRate.value }
          : {}),
        ...(primary.variantTaskRate?.value != null
          ? { variantTaskRate: primary.variantTaskRate.value }
          : {}),
        points: primary.points.value ?? 0,
        lo: primary.interval.lo,
        hi: primary.interval.hi,
        ...(primary.metric ? { metric: primary.metric } : {}),
        ...(primary.k !== undefined ? { k: primary.k } : {}),
        ...(primary.baselinePassAtK?.value != null
          ? { baselinePassAtK: primary.baselinePassAtK.value }
          : {}),
        ...(primary.variantPassAtK?.value != null
          ? { variantPassAtK: primary.variantPassAtK.value }
          : {}),
        ...(primary.baselinePassHatK?.value != null
          ? { baselinePassHatK: primary.baselinePassHatK.value }
          : {}),
        ...(primary.variantPassHatK?.value != null
          ? { variantPassHatK: primary.variantPassHatK.value }
          : {}),
        ...(primary.saturated ? { saturated: true } : {}),
      }
    case 'tied-ceiling':
      return {
        kind: 'tied-ceiling',
        baseline: primary.baseline.label,
        variant: primary.variant.label,
        passed: proportion(primary.rate),
        measure: primary.lead.measure,
        baselineMedian: primary.lead.baseline.value ?? 0,
        variantMedian: primary.lead.variant.value ?? 0,
        ...(primary.metric ? { metric: primary.metric } : {}),
        ...(primary.k !== undefined ? { k: primary.k } : {}),
        ...(primary.passAtK?.value != null ? { passAtK: primary.passAtK.value } : {}),
        ...(primary.passHatK?.value != null ? { passHatK: primary.passHatK.value } : {}),
        ...(primary.saturated ? { saturated: true } : {}),
      }
    case 'choice':
      return {
        kind: 'choice',
        question: primary.question,
        options: primary.options,
        attempts: primary.attempts,
      }
    case 'measure':
      return {
        kind: 'measure',
        label: primary.label,
        unit: primary.unit,
        median: primary.spread.median.value,
        n: primary.spread.n,
      }
    case 'judge':
      return {
        kind: 'judge',
        label: primary.label,
        scale: primary.scale,
        median: primary.spread.median.value,
        n: primary.spread.n,
      }
    case 'text':
      return { kind: 'text', question: primary.question, answered: proportion(primary.answered) }
    case 'regression':
      return { kind: 'regression', worse: primary.worse, fixed: primary.fixed, lead: primary.lead }
  }
}

function chooseHeadline(
  e: EvalEntry,
  arms: Arm[],
  prior: Ctx['prior'],
  regression: RegressionChanges | null,
  metricCfg: ResolvedMetric,
): {
  primary: HeadlinePrimary
  fairness: Fairness
  foot: string
  kicker: string | null
  saturated?: boolean
} {
  const harnesses = new Set(e.cells.map((c) => c.harness)).size
  const assertions = assertionLabels(e)
  const compare = Boolean(e.compare)
  const passFail = isPassFailEval(e)
  const tasks = passFail ? evalTasks(e) : []
  const multiTask = tasks.length > 1

  let kicker: string | null = null
  if (regression && prior) {
    const p = regression.prior
    const when = p.startedAt.slice(0, 10)
    const sha = p.gitSha ? p.gitSha.slice(0, 7) : null
    const bits = [when, sha, p.runId].filter(Boolean)
    kicker = `Compared with ${bits.join(', ')}`
  }

  if (regression) {
    const worse = regression.rows.filter((r) => r.status === 'regressed').length
    const fixed = regression.rows.filter((r) => r.status === 'fixed').length
    const lead =
      regression.rows.find((r) => r.gate && (r.status === 'regressed' || r.status === 'fixed')) ??
      regression.rows.find((r) => r.status === 'regressed' || r.status === 'fixed') ??
      regression.rows[0] ??
      null
    const sampleNs = (prior?.rows ?? []).flatMap((row) =>
      (row.perCell ?? []).map((c) =>
        Math.min(c.base.pass + c.base.fail, c.head.pass + c.head.fail),
      ),
    )
    const minN = sampleNs.length ? Math.min(...sampleNs) : COMPARE_RUNS
    const fairness: Fairness = minN < COMPARE_RUNS ? 'too-few-runs' : 'clear'
    const footParts = [
      `${worse} worse, ${fixed} fixed since ${regression.prior.runId}.`,
      regression.prior.gitSha
        ? `Prior ${regression.prior.startedAt.slice(0, 10)} at ${regression.prior.gitSha.slice(0, 7)}.`
        : `Prior ${regression.prior.startedAt.slice(0, 10)}.`,
      fairness === 'too-few-runs' ? floorSentence('too-few-runs', minN) : null,
    ]
    return {
      primary: { kind: 'regression', worse, fixed, lead },
      fairness,
      foot: footParts.filter(Boolean).join(' '),
      kicker,
    }
  }

  if (compare && arms.length >= 2 && passFail) {
    const baseline = arms.find((a) => a.role === 'baseline')!
    const variants = arms.filter((a) => a.role === 'variant')
    const cellsFor = (arm: Arm) =>
      e.cells.filter((c) => (c.environmentDigest ?? c.environment) === arm.id)
    const attemptsFor = (arm: Arm) =>
      e.attempts.filter((a) => {
        const cell = cellOf(e, a.cell)
        return cell && (cell.environmentDigest ?? cell.environment) === arm.id
      })
    const rateFor = (arm: Arm) => passRateForAttempts(attemptsFor(arm))
    const scopeFor = (arm: Arm) =>
      scoreScope(e, tasks, attemptsFor(arm), cellsFor(arm), metricCfg.k)
    const baselineRate = rateFor(baseline)
    const baseScope = scopeFor(baseline)
    const lifts = variants.map((v) => {
      const rate = rateFor(v)
      const scope = scopeFor(v)
      const nV = rate.n
      const nB = baselineRate.n
      const { points, low, high } = liftInterval(
        { pass: rate.k, n: nV },
        { pass: baselineRate.k, n: nB },
      )
      const taskPoints =
        scope.rawTaskRate !== null && baseScope.rawTaskRate !== null
          ? ptsDelta(scope.rawTaskRate - baseScope.rawTaskRate)
          : undefined
      return {
        variant: { id: v.id, label: v.label } satisfies ArmRef,
        points: ptsDelta(points),
        interval: ptsInterval(low, high),
        rate,
        scope,
        taskPoints,
        rawPoints: points,
        rawTaskPoints:
          scope.rawTaskRate !== null && baseScope.rawTaskRate !== null
            ? scope.rawTaskRate - baseScope.rawTaskRate
            : points,
        lo: low,
        hi: high,
        n: Math.min(nV, nB),
      }
    })
    lifts.sort((a, b) => {
      const aMag =
        metricCfg.lead === 'task-pass-rate' ? Math.abs(a.rawTaskPoints) : Math.abs(a.rawPoints)
      const bMag =
        metricCfg.lead === 'task-pass-rate' ? Math.abs(b.rawTaskPoints) : Math.abs(b.rawPoints)
      return bMag - aMag
    })
    const best = lifts[0]!
    kicker = `${best.variant.label} against the ${baseline.label} baseline`
    const others = lifts.slice(1).map(({ variant, points, interval, rate, scope, taskPoints }) => ({
      variant,
      points,
      interval,
      rate,
      ...(scope.taskRate ? { taskRate: scope.taskRate } : {}),
      ...(taskPoints ? { taskPoints } : {}),
      ...(scope.k !== undefined ? { k: scope.k } : {}),
      ...(scope.passAtK ? { passAtK: scope.passAtK } : {}),
      ...(scope.passHatK ? { passHatK: scope.passHatK } : {}),
      ...(scope.passKOmitted ? { passKOmitted: scope.passKOmitted } : {}),
    }))
    const fairness = fairnessOf(best.rate.n, baselineRate.n, { lo: best.lo, hi: best.hi })
    const allArmsAtCeiling =
      baselineRate.rate === 1 &&
      baselineRate.n > 0 &&
      lifts.every((l) => l.rate.rate === 1 && l.rate.n > 0)
    const tied = REPORT_POLICY.tiedCeiling && allArmsAtCeiling && assertions.length > 0

    const bothHavePassK =
      best.scope.rawPassAtK !== undefined &&
      best.scope.rawPassHatK !== undefined &&
      baseScope.rawPassAtK !== undefined &&
      baseScope.rawPassHatK !== undefined
    const omittedReason = best.scope.passKOmitted ?? baseScope.passKOmitted

    if (tied) {
      const baseAttempts = attemptsFor(baseline).filter((a) => a.outcome === 'pass')
      const varAttempts = attemptsFor(variants.find((v) => v.id === best.variant.id)!).filter(
        (a) => a.outcome === 'pass',
      )
      const baseMeasures = measuresOf(baseAttempts, true)
      const varMeasures = measuresOf(varAttempts, true)
      let lead: {
        measure: MeasureKey
        baseline: Figure
        variant: Figure
        delta: ReturnType<typeof pctDelta>
        abs: number
      } | null = null
      for (const key of MEASURE_KEYS) {
        const b = baseMeasures[key]?.median
        const v = varMeasures[key]?.median
        if (!b || !v || b.value === null || v.value === null) continue
        const delta = pctDelta(v.value, b.value)
        if (delta.value === null) continue
        const abs = Math.abs(delta.value)
        if (abs < 0.1) continue
        if (!lead || abs > lead.abs) {
          lead = { measure: key, baseline: b, variant: v, delta, abs }
        }
      }
      if (lead) {
        const totalN = arms.reduce((sum, a) => sum + rateFor(a).n, 0)
        const passKNote =
          metricCfg.k !== null
            ? bothHavePassK
              ? `Pass@${metricCfg.k} ${best.scope.passAtK!.text}, Pass^${metricCfg.k} ${best.scope.passHatK!.text}.`
              : omittedReason
                ? `Pass@${metricCfg.k} and Pass^${metricCfg.k} omitted: ${omittedReason}.`
                : null
            : null
        const footParts = [
          `No failures in ${trialsText(totalN)} across ${arms.length} arms on all ${assertions.length} applicable assertion${assertions.length === 1 ? '' : 's'} (${baseline.label} 95% Wilson CI ${wilsonRangeText(baselineRate.interval)}, ${best.variant.label} ${wilsonRangeText(best.rate.interval)}).`,
          SATURATION_NOTE,
          passKNote,
        ]
        return {
          primary: {
            kind: 'tied-ceiling',
            baseline: { id: baseline.id, label: baseline.label },
            variant: best.variant,
            rate: baselineRate,
            ...(baseScope.taskRate ? { taskRate: baseScope.taskRate, tasks: tasks.length } : {}),
            assertions: assertions.length,
            lead: {
              measure: lead.measure,
              baseline: lead.baseline,
              variant: lead.variant,
              delta: lead.delta,
            },
            ...(metricCfg.configured ? { metric: metricCfg.lead } : {}),
            ...(metricCfg.k !== null ? { k: metricCfg.k } : {}),
            ...(bothHavePassK
              ? { passAtK: best.scope.passAtK, passHatK: best.scope.passHatK }
              : omittedReason
                ? { passKOmitted: omittedReason }
                : {}),
            saturated: true,
          },
          fairness,
          foot: footParts.filter(Boolean).join(' '),
          kicker,
          saturated: true,
        }
      }
    }

    const floor = floorSentence(fairness, best.n)
    const ceilingNotes = allArmsAtCeiling
      ? [
          `No failures in ${best.rate.n} vs ${baselineRate.n} trials (${baseline.label} 95% Wilson CI ${wilsonRangeText(baselineRate.interval)}, ${best.variant.label} ${wilsonRangeText(best.rate.interval)}).`,
          SATURATION_NOTE,
        ]
      : [
          smallCeilingSentence(best.variant.label, best.rate),
          smallCeilingSentence(baseline.label, baselineRate),
        ]
    const taskFoot =
      multiTask && best.scope.taskRate && baseScope.taskRate && best.taskPoints
        ? `Task-averaged: ${best.scope.taskRate.text} vs ${baseScope.taskRate.text} (${best.taskPoints.text} across ${tasks.length} tasks)${metricCfg.lead === 'task-pass-rate' ? `; pooled pass rate ${best.rate.text} vs ${baselineRate.text}` : ''}.`
        : null
    const passKFoot =
      metricCfg.k !== null
        ? bothHavePassK
          ? `Pass@${metricCfg.k} ${best.scope.passAtK!.text} vs ${baseScope.passAtK!.text}, Pass^${metricCfg.k} ${best.scope.passHatK!.text} vs ${baseScope.passHatK!.text}${metricCfg.lead === 'pass@k' || metricCfg.lead === 'pass^k' ? `; pooled pass rate ${best.rate.text} vs ${baselineRate.text}` : ''}.`
          : omittedReason
            ? `Pass@${metricCfg.k} and Pass^${metricCfg.k} omitted: ${omittedReason}.`
            : null
        : null
    return {
      primary: {
        kind: 'lift',
        baseline: { id: baseline.id, label: baseline.label },
        variant: best.variant,
        points: best.points,
        interval: best.interval,
        baselineRate,
        variantRate: best.rate,
        ...(multiTask && baseScope.taskRate && best.scope.taskRate && best.taskPoints
          ? {
              baselineTaskRate: baseScope.taskRate,
              variantTaskRate: best.scope.taskRate,
              taskPoints: best.taskPoints,
              tasks: tasks.length,
            }
          : {}),
        ...(metricCfg.configured ? { metric: metricCfg.lead } : {}),
        ...(metricCfg.k !== null ? { k: metricCfg.k } : {}),
        ...(bothHavePassK
          ? {
              baselinePassAtK: baseScope.passAtK,
              variantPassAtK: best.scope.passAtK,
              passAtKPoints: ptsDelta(best.scope.rawPassAtK! - baseScope.rawPassAtK!),
              baselinePassHatK: baseScope.passHatK,
              variantPassHatK: best.scope.passHatK,
              passHatKPoints: ptsDelta(best.scope.rawPassHatK! - baseScope.rawPassHatK!),
            }
          : omittedReason
            ? { passKOmitted: omittedReason }
            : {}),
        ...(allArmsAtCeiling ? { saturated: true } : {}),
        others,
      },
      fairness,
      foot: [
        `${best.rate.n} vs ${baselineRate.n} trials. 95% CI ${best.interval.text}.`,
        ...ceilingNotes,
        taskFoot,
        passKFoot,
        floor,
      ]
        .filter(Boolean)
        .join(' '),
      kicker,
      ...(allArmsAtCeiling ? { saturated: true } : {}),
    }
  }

  if (assertions.length > 0) {
    const gatedCells = e.cells.filter((c) => c.gate !== 'none')
    const activeCells = gatedCells.length ? gatedCells : e.cells
    const gated = e.attempts.filter((a) => {
      const cell = cellOf(e, a.cell)
      return cell && cell.gate !== 'none' && countedOutcome(a.outcome)
    })
    const pool = gated.length ? gated : e.attempts.filter((a) => countedOutcome(a.outcome))
    let passedAll = 0
    for (const a of pool) {
      if (a.outcome !== 'pass') continue
      const applicable = (a.assertions ?? []).filter(
        (x) => (x.status as string) !== 'not_applicable',
      )
      if (applicable.length === 0) continue
      if (applicable.every((x) => x.status === 'pass')) passedAll++
    }
    const rate = rateOf(passedAll, pool.length)
    const scope = scoreScope(e, tasks, pool, activeCells, metricCfg.k)
    const outcome = passRateOutcomeFromMatchers(assertions.map((a) => a.matcher)) ?? 'passed'
    const outcomeWord = PASS_RATE_OUTCOME_LABEL[outcome]
    const assertionPhrase =
      assertions.length === 1 ? 'on 1 assertion' : `on all ${assertions.length} assertions`
    const baseSentence =
      rate.rate === 1 && rate.n > 0 && rate.n < SMALL_CERTAINTY_N
        ? `No failures in ${trialsText(rate.n)} ${assertionPhrase} (95% Wilson CI ${wilsonRangeText(rate.interval)}); small sample does not rule out failures.`
        : rate.rate === 1 && rate.n > 0
          ? `No failures in ${trialsText(rate.n)} ${assertionPhrase} (95% Wilson CI ${wilsonRangeText(rate.interval)}).`
          : `${rate.k} of ${trialsText(rate.n)} ${outcomeWord} on all ${assertions.length} assertions.`
    const taskSentence =
      multiTask && scope.taskRate
        ? `Task-averaged: ${scope.taskRate.text} across ${tasks.length} tasks${metricCfg.lead === 'task-pass-rate' ? ` (pooled ${rate.text})` : ''}.`
        : null
    const passKSentence =
      metricCfg.k !== null
        ? scope.passAtK && scope.passHatK
          ? `Pass@${metricCfg.k} ${scope.passAtK.text}, Pass^${metricCfg.k} ${scope.passHatK.text}${metricCfg.lead === 'pass@k' || metricCfg.lead === 'pass^k' ? ` (pooled ${rate.text})` : ''}.`
          : scope.passKOmitted
            ? `Pass@${metricCfg.k} and Pass^${metricCfg.k} omitted: ${scope.passKOmitted}.`
            : null
        : null
    return {
      primary: {
        kind: 'pass-rate',
        rate,
        ...(multiTask && scope.taskRate ? { taskRate: scope.taskRate, tasks: tasks.length } : {}),
        assertions: assertions.length,
        harnesses: Math.max(1, harnesses),
        outcome,
        ...(metricCfg.configured ? { metric: metricCfg.lead } : {}),
        ...(scope.k !== undefined ? { k: scope.k } : {}),
        ...(scope.passAtK && scope.passHatK
          ? { passAtK: scope.passAtK, passHatK: scope.passHatK }
          : scope.passKOmitted
            ? { passKOmitted: scope.passKOmitted }
            : {}),
      },
      fairness: pool.length < COMPARE_RUNS ? 'too-few-runs' : 'clear',
      foot: [
        baseSentence,
        taskSentence,
        passKSentence,
        `${harnesses} coding harness${harnesses === 1 ? '' : 'es'}.`,
      ]
        .filter(Boolean)
        .join(' '),
      kicker,
    }
  }

  const answers = attemptAnswerRows(e)
  const choiceRow = answers.find((r) => r.choices && r.choices.length >= 2)
  if (choiceRow?.choices) {
    const options = choiceRow.choices.map((c) => ({ label: c.choice, count: c.n }))
    const noPick = choiceRow.answers.filter((a) => !a.choice).length
    return {
      primary: {
        kind: 'choice',
        question: choiceRow.question,
        options,
        attempts: choiceRow.answers.length,
        noPick,
      },
      fairness: 'clear',
      foot: `${trialsText(choiceRow.answers.length)}, ${noPick} without a pick.`,
      kicker,
    }
  }

  const judgeRows = e.attempts.flatMap((a) => labeledJudgments(a))
  if (judgeRows.length) {
    const first = judgeRows[0]!
    const scores = judgeRows.filter((j) => j.label === first.label).map((j) => j.judgment.score)
    const spread = spreadOf(scores, (n) => n.toFixed(2))!
    const assertion = first.check ?? null
    const threshold = assertion === null ? null : (first.judgment.threshold ?? null)
    const atOrAbove =
      threshold === null
        ? null
        : countOf(scores.filter((s) => s >= threshold).length, scores.length)
    return {
      primary: {
        kind: 'judge',
        label: first.label,
        question: first.judgment.question,
        scale: [0, 1],
        threshold,
        spread,
        atOrAbove,
      },
      fairness: scores.length < COMPARE_RUNS ? 'too-few-runs' : 'clear',
      foot: atOrAbove
        ? `${atOrAbove.k} of ${trialsText(atOrAbove.n)} at or above the ${threshold} threshold.`
        : `${trialsText(spread.n)}; diagnostic judgment, no threshold.`,
      kicker,
    }
  }

  const observeNumeric = e.attempts.flatMap((a) =>
    (a.observations ?? []).flatMap((o) =>
      typeof o.value === 'number' ? [{ name: o.name, value: o.value }] : [],
    ),
  )
  if (observeNumeric.length) {
    const name = observeNumeric[0]!.name
    const values = observeNumeric.filter((o) => o.name === name).map((o) => o.value)
    const spread = spreadOf(values, formatCount)!
    return {
      primary: { kind: 'measure', label: name, unit: 'count', spread },
      fairness: values.length < COMPARE_RUNS ? 'too-few-runs' : 'clear',
      foot: `${trialsText(spread.n)}, interquartile range ${spread.q1.text} to ${spread.q3.text}.`,
      kicker,
    }
  }

  const textRow = answers.find((r) => !r.choices)
  if (textRow) {
    const answered = textRow.answers.filter((a) => a.text.trim())
    const leadAnswer = answered[0]
    let lead: Quote | null = null
    if (leadAnswer) {
      const attempt = e.attempts.find((a) => a.id === leadAnswer.attempt)
      if (attempt) {
        // fillTextLeadCites replaces the citation, or drops the lead when the attempt has no id.
        lead = {
          text: leadAnswer.text.slice(0, 200),
          attempt: { id: 'A?', key: attempt.key, href: '#' },
          harness: cellOf(e, attempt.cell)?.harness ?? attempt.cell,
          arm: cellOf(e, attempt.cell)?.environment ?? null,
          case: attempt.case ?? null,
          input: leadAnswer.input,
        }
      }
    }
    const leadRole =
      answered.length > 1 && lead ? 'representative' : answered.length === 1 && lead ? 'sole' : null
    return {
      primary: {
        kind: 'text',
        question: textRow.question,
        answered: countOf(answered.length, textRow.answers.length),
        lead,
        leadRole,
      },
      fairness: 'clear',
      foot:
        leadRole === 'representative'
          ? `${answered.length} of ${trialsText(textRow.answers.length)} answered. Showing 1 representative answer.`
          : `${answered.length} of ${trialsText(textRow.answers.length)} answered.`,
      kicker,
    }
  }

  const tokenValues = e.attempts
    .filter((a) => countedOutcome(a.outcome) && a.usage)
    .map((a) => totalTokens(a.usage!))
  const spread =
    spreadOf(tokenValues, tokensText) ??
    ({
      n: 0,
      median: tokensFigure(null),
      q1: tokensFigure(null),
      q3: tokensFigure(null),
    } satisfies Spread)
  return {
    primary: { kind: 'measure', label: 'tokens', unit: 'tokens', spread },
    fairness: tokenValues.length < COMPARE_RUNS ? 'too-few-runs' : 'clear',
    foot:
      spread.n === 0
        ? 'No trial reported usage.'
        : `${trialsText(spread.n)}, interquartile range ${spread.q1.text} to ${spread.q3.text}.`,
    kicker,
  }
}

function buildTaskResults(e: EvalEntry, metricCfg: ResolvedMetric): TaskResults | null {
  const labels = assertionLabels(e)
  if (!labels.length) return null
  const tasks = evalTasks(e)
  const multiTask = tasks.length > 1
  const costReported = costReportedOnEval(e)
  const harnesses = [...new Set(e.cells.map((c) => c.harness))]
  const columns = harnesses
  const assertions: AssertionRow[] = labels.map((row) => {
    const cells: Record<string, CheckCell> = {}
    for (const h of columns) {
      const attempts = e.attempts.filter((a) => cellOf(e, a.cell)?.harness === h)
      cells[h] = checkCellOf(attempts, row.label)
    }
    const total = checkCellOf(
      e.attempts.filter((a) => countedOutcome(a.outcome) || a.outcome === 'infra_error'),
      row.label,
    )
    return { label: row.label, matcher: row.matcher, at: row.at, cells, total }
  })
  const axes = ['Coding harness']
  const breakdown: BreakdownRow[] = harnesses.map((h) => {
    const hCells = e.cells.filter((c) => c.harness === h)
    const attempts = e.attempts.filter((a) => cellOf(e, a.cell)?.harness === h)
    const scope = scoreScope(e, tasks, attempts, hCells, metricCfg.k)
    const cps = costPerSuccess(attempts)
    return {
      keys: [h],
      rate: passRateForAttempts(attempts),
      ...(multiTask ? { taskRate: scope.taskRate ?? null } : {}),
      ...(scope.k !== undefined ? { k: scope.k } : {}),
      ...(scope.passAtK && scope.passHatK
        ? { passAtK: scope.passAtK, passHatK: scope.passHatK }
        : scope.passKOmitted
          ? { passKOmitted: scope.passKOmitted }
          : {}),
      measures: measuresOf(attempts, true),
      costPerSuccess: cps === null ? null : usdFigure(cps),
    }
  })
  const gatedCells = e.cells.filter((c) => c.gate !== 'none')
  const totalCells = gatedCells.length ? gatedCells : e.cells
  const gatedAttempts = e.attempts.filter((a) => {
    const cell = cellOf(e, a.cell)
    return cell && cell.gate !== 'none'
  })
  const totalPool = gatedAttempts.some((a) => countedOutcome(a.outcome))
    ? gatedAttempts
    : e.attempts
  const overallScope = scoreScope(e, tasks, totalPool, totalCells, metricCfg.k)
  const allCps = costPerSuccess(e.attempts)
  const medianRow: BreakdownRow | null =
    breakdown.length > 1
      ? {
          keys: ['Median'],
          rate: passRateForAttempts(e.attempts),
          ...(multiTask
            ? { taskRate: scoreScope(e, tasks, e.attempts, e.cells, null).taskRate ?? null }
            : {}),
          ...(overallScope.k !== undefined ? { k: overallScope.k } : {}),
          ...(overallScope.passAtK && overallScope.passHatK
            ? { passAtK: overallScope.passAtK, passHatK: overallScope.passHatK }
            : overallScope.passKOmitted
              ? { passKOmitted: overallScope.passKOmitted }
              : {}),
          measures: measuresOf(e.attempts, true),
          costPerSuccess: allCps === null ? null : usdFigure(allCps),
        }
      : null
  const taskRows: TaskRow[] | undefined = multiTask
    ? tasks.map((t) => {
        const cells: Record<string, TaskCell> = {}
        for (const h of columns) {
          const hCells = e.cells.filter((c) => c.harness === h && !isExcludedForTask(e, t.task, c))
          const hAttempts = e.attempts.filter((a) => cellOf(e, a.cell)?.harness === h && t.match(a))
          cells[h] = buildTaskCell(hAttempts, hCells, metricCfg.k)
        }
        const activeTotalCells = totalCells.filter((c) => !isExcludedForTask(e, t.task, c))
        const totalTaskAttempts = totalPool.filter((a) => t.match(a))
        return {
          task: t.task,
          label: t.label,
          cells,
          total: buildTaskCell(totalTaskAttempts, activeTotalCells, metricCfg.k),
        }
      })
    : undefined
  return {
    kind: 'task',
    columns,
    assertions,
    axes,
    breakdown,
    median: medianRow,
    ...(metricCfg.configured ? { metric: metricCfg.lead } : {}),
    ...(overallScope.k !== undefined ? { k: overallScope.k } : {}),
    ...(overallScope.passAtK && overallScope.passHatK
      ? { passAtK: overallScope.passAtK, passHatK: overallScope.passHatK }
      : overallScope.passKOmitted
        ? { passKOmitted: overallScope.passKOmitted }
        : {}),
    costReported,
    ...(taskRows ? { tasks: taskRows } : {}),
  }
}

function buildVariantComparison(
  e: EvalEntry,
  arms: Arm[],
  metricCfg: ResolvedMetric,
): VariantComparison {
  const passFail = isPassFailEval(e)
  const tasks = passFail ? evalTasks(e) : []
  const multiTask = tasks.length > 1
  const costReported = passFail && costReportedOnEval(e)
  const baseline = arms.find((a) => a.role === 'baseline')
  const cellsFor = (arm: Arm) =>
    e.cells.filter((c) => (c.environmentDigest ?? c.environment) === arm.id)
  const attemptsFor = (arm: Arm) =>
    e.attempts.filter((a) => {
      const cell = cellOf(e, a.cell)
      return cell && (cell.environmentDigest ?? cell.environment) === arm.id
    })

  const baseAttempts = baseline
    ? attemptsFor(baseline).filter((a) => countedOutcome(a.outcome))
    : []
  const baseMeasures = measuresOf(baseAttempts, passFail)
  const baseRate = passRateForAttempts(baseAttempts)
  const baseScope =
    passFail && baseline
      ? scoreScope(e, tasks, baseAttempts, cellsFor(baseline), metricCfg.k)
      : null
  const baseCps = passFail && baseline ? costPerSuccess(baseAttempts) : null

  const summary: ArmRow[] = arms.map((arm) => {
    const attempts = attemptsFor(arm).filter((a) => countedOutcome(a.outcome))
    const rate = passRateForAttempts(attempts)
    const scope = passFail ? scoreScope(e, tasks, attempts, cellsFor(arm), metricCfg.k) : null
    const measures = measuresOf(attempts, passFail)
    const vs = emptyMeasureVsBaseline()
    for (const key of MEASURE_KEYS) {
      vs[key] = measureVs(measures[key], arm.role === 'baseline' ? null : baseMeasures[key], null)
    }
    const cps = passFail ? costPerSuccess(attempts) : undefined
    const cpsFig = cps === undefined ? undefined : cps === null ? null : usdFigure(cps)
    const cpsDelta = !passFail
      ? undefined
      : arm.role === 'baseline' || cps === null || cps === undefined || baseCps === null
        ? null
        : pctDelta(cps, baseCps)
    const passKFields = scope
      ? {
          ...(multiTask && scope.taskRate ? { taskRate: scope.taskRate } : {}),
          ...(scope.k !== undefined ? { k: scope.k } : {}),
          ...(scope.passAtK && scope.passHatK
            ? { passAtK: scope.passAtK, passHatK: scope.passHatK }
            : scope.passKOmitted
              ? { passKOmitted: scope.passKOmitted }
              : {}),
        }
      : {}
    if (arm.role === 'baseline') {
      return {
        arm: arm.label,
        rate,
        ...passKFields,
        ...(multiTask && passFail ? { taskLift: null } : {}),
        lift: null,
        interval: null,
        verdict: 'baseline' as const,
        verdictScope: 'pass-rate' as const,
        measures: vs,
        ...(passFail ? { costPerSuccess: cpsFig ?? null, costPerSuccessDelta: null } : {}),
      }
    }
    const { points, low, high } = liftInterval(
      { pass: rate.k, n: rate.n },
      { pass: baseRate.k, n: baseRate.n },
    )
    const fairness = fairnessOf(rate.n, baseRate.n, { lo: low, hi: high })
    const verdict =
      fairness === 'too-few-runs'
        ? 'too-few-runs'
        : fairness === 'within-noise'
          ? 'within-noise'
          : points > 0
            ? 'helped'
            : points < 0
              ? 'made-worse'
              : 'within-noise'
    const taskLift =
      multiTask && passFail && scope?.rawTaskRate != null && baseScope?.rawTaskRate != null
        ? ptsDelta(scope.rawTaskRate - baseScope.rawTaskRate)
        : multiTask && passFail
          ? null
          : undefined
    const keys = new Set(cellsFor(arm).map((c) => c.key))
    const missedLift =
      (e.lifts ?? []).find((l) => keys.has(l.variant) && l.outcome === 'fail')?.minLift ??
      cellsFor(arm).find(
        (c) => c.lift?.minLift !== undefined && c.lift.interval.lo < c.lift.minLift,
      )?.lift?.minLift
    return {
      arm: arm.label,
      rate,
      ...passKFields,
      ...(taskLift !== undefined ? { taskLift } : {}),
      ...(missedLift !== undefined ? { missedMinLift: missedLift } : {}),
      lift: ptsDelta(points),
      interval: ptsInterval(low, high),
      verdict,
      verdictScope: 'pass-rate' as const,
      measures: vs,
      ...(passFail
        ? { costPerSuccess: cpsFig ?? null, costPerSuccessDelta: cpsDelta ?? null }
        : {}),
    }
  })

  const saturated =
    passFail && arms.length >= 2 && summary.every((row) => row.rate.rate === 1 && row.rate.n > 0)

  const taskRows: TaskRow[] | undefined =
    passFail && multiTask
      ? tasks.map((t) => {
          const cells: Record<string, TaskCell> = {}
          for (const arm of arms) {
            const armCells = cellsFor(arm).filter((c) => !isExcludedForTask(e, t.task, c))
            const armAttempts = attemptsFor(arm).filter((a) => t.match(a))
            cells[arm.label] = buildTaskCell(armAttempts, armCells, metricCfg.k)
          }
          return {
            task: t.task,
            label: t.label,
            cells,
            total: null,
          }
        })
      : undefined

  const labels = assertionLabels(e)
  const columns = arms.map((a) => a.label)
  let uniform = labels.length > 0
  const assertionsByArm: AssertionRow[] = []
  for (const row of labels) {
    const cells: Record<string, CheckCell> = {}
    for (const arm of arms) {
      cells[arm.label] = checkCellOf(attemptsFor(arm), row.label)
      const cell = cells[arm.label]!
      if (cell.status !== 'pass' && cell.status !== 'na') uniform = false
    }
    const total = checkCellOf(e.attempts, row.label)
    assertionsByArm.push({
      label: row.label,
      matcher: row.matcher,
      at: row.at,
      cells,
      total,
    })
  }
  const uniformLead = uniform
    ? `Every arm passed every applicable assertion (${labels.length} checks).`
    : null

  const contrasts: ContrastRow[] = contrastsOf(e).flatMap((c) => {
    const aCell = cellOf(e, c.a)
    const bCell = cellOf(e, c.b)
    if (!aCell || !bCell || !c.lift) return []
    const fairness = fairnessOf(c.lift.variant.counted, c.lift.control.counted, c.lift.interval)
    const verdict =
      fairness === 'too-few-runs'
        ? 'too-few-runs'
        : fairness === 'within-noise'
          ? 'within-noise'
          : c.lift.points > 0
            ? 'helped'
            : c.lift.points < 0
              ? 'made-worse'
              : 'within-noise'
    return [
      {
        from: aCell.variant ?? aCell.environment,
        to: bCell.variant ?? bCell.environment,
        harness: aCell.harness,
        sandbox: aCell.sandbox,
        fromPassed: { k: c.lift.variant.pass, n: c.lift.variant.counted },
        toPassed: { k: c.lift.control.pass, n: c.lift.control.counted },
        ...(passFail && c.taskPoints !== undefined ? { taskDelta: ptsDelta(c.taskPoints) } : {}),
        ...(passFail && c.brokenTasks ? { brokenTasks: c.brokenTasks } : {}),
        measure: 'pass-rate' as const,
        delta: ptsDelta(c.lift.points),
        interval: ptsInterval(c.lift.interval.lo, c.lift.interval.hi),
        verdict,
        verdictScope: 'pass-rate' as const,
      },
    ]
  })

  const harnesses = [...new Set(e.cells.map((c) => c.harness))]
  const effortByHarness = harnesses.flatMap((h) =>
    arms.map((arm) => {
      const hArmCells = cellsFor(arm).filter((c) => c.harness === h)
      const attempts = e.attempts.filter((a) => {
        const cell = cellOf(e, a.cell)
        return (
          cell?.harness === h &&
          cell &&
          (cell.environmentDigest ?? cell.environment) === arm.id &&
          countedOutcome(a.outcome)
        )
      })
      const scope = passFail ? scoreScope(e, tasks, attempts, hArmCells, metricCfg.k) : null
      const measures = measuresOf(attempts, passFail)
      const vs = emptyMeasureVsBaseline()
      const baseH = baseline
        ? e.attempts.filter((a) => {
            const cell = cellOf(e, a.cell)
            return (
              cell?.harness === h &&
              cell &&
              (cell.environmentDigest ?? cell.environment) === baseline.id &&
              countedOutcome(a.outcome)
            )
          })
        : []
      const baseM = measuresOf(baseH, passFail)
      for (const key of MEASURE_KEYS) {
        vs[key] = measureVs(measures[key], arm.role === 'baseline' ? null : baseM[key], null)
      }
      const hCps = passFail ? costPerSuccess(attempts) : undefined
      const baseHCps = passFail && baseline ? costPerSuccess(baseH) : null
      const hCpsDelta = !passFail
        ? undefined
        : arm.role === 'baseline' || hCps === null || hCps === undefined || baseHCps === null
          ? null
          : pctDelta(hCps, baseHCps)
      return {
        harness: h,
        arm: arm.label,
        rate: passRateForAttempts(attempts),
        ...(multiTask && scope?.taskRate ? { taskRate: scope.taskRate } : {}),
        ...(scope?.k !== undefined ? { k: scope.k } : {}),
        ...(scope?.passAtK && scope.passHatK
          ? { passAtK: scope.passAtK, passHatK: scope.passHatK }
          : scope?.passKOmitted
            ? { passKOmitted: scope.passKOmitted }
            : {}),
        measures: vs,
        ...(passFail
          ? {
              costPerSuccess: hCps === null || hCps === undefined ? null : usdFigure(hCps),
              costPerSuccessDelta: hCpsDelta ?? null,
            }
          : {}),
      }
    }),
  )

  return {
    kind: 'comparison',
    arms,
    uniformLead,
    ...(passFail && metricCfg.configured ? { metric: metricCfg.lead } : {}),
    ...(passFail && metricCfg.k !== null ? { k: metricCfg.k } : {}),
    ...(passFail ? { costReported } : {}),
    ...(saturated ? { saturated: true, saturationNote: SATURATION_NOTE } : {}),
    summary,
    ...(taskRows ? { tasks: taskRows } : {}),
    assertionsByArm: uniformLead ? [] : assertionsByArm,
    behavior: [],
    contrasts,
    effortByHarness,
  }
}

function compareSidePassed(row: CompareRow, side: 'base' | 'head'): Proportion | null {
  const cells = row.perCell
  if (!cells?.length) return null
  const k = cells.reduce((n, c) => n + c[side].pass, 0)
  const n = k + cells.reduce((n, c) => n + c[side].fail, 0)
  return n > 0 ? { k, n } : null
}

function compareSideText(row: CompareRow, side: 'base' | 'head'): string {
  const passed = compareSidePassed(row, side)
  return passed ? proportionText(passed) : (row[side] ?? 'n/a')
}

function compareSideDelta(row: CompareRow): ReturnType<typeof ptsDelta> | null {
  const cells = row.perCell
  if (!cells?.length) return null
  const basePass = cells.reduce((n, c) => n + c.base.pass, 0)
  const baseN = cells.reduce((n, c) => n + c.base.pass + c.base.fail, 0)
  const headPass = cells.reduce((n, c) => n + c.head.pass, 0)
  const headN = cells.reduce((n, c) => n + c.head.pass + c.head.fail, 0)
  if (!baseN || !headN) return null
  return ptsDelta(headPass / headN - basePass / baseN)
}

function buildRegression(prior: NonNullable<Ctx['prior']>): RegressionChanges {
  const rows: ChangeRow[] = []
  const unchanged: ChangeRow[] = []
  for (const row of prior.rows) {
    const change: ChangeRow = {
      signal: row.id,
      kind: 'outcome',
      harness: null,
      prior: compareSideText(row, 'base'),
      current: compareSideText(row, 'head'),
      priorPassed: compareSidePassed(row, 'base'),
      currentPassed: compareSidePassed(row, 'head'),
      delta: compareSideDelta(row),
      status: row.status,
      gate: Boolean(row.gate),
    }
    if (row.status === 'same') unchanged.push(change)
    else rows.push(change)
  }
  const whatChanged = [
    ...prior.changes.map((c) => `${c.label}: ${c.base} to ${c.head}`),
    ...prior.rows.flatMap((r) => (r.changes ?? []).map((c) => `${r.id}: ${c}`)),
  ]
  const priorRec = prior.record
  return {
    kind: 'regression',
    baseRunId: priorRec.runId,
    prior: {
      runId: priorRec.runId,
      startedAt: priorRec.startedAt,
      gitSha: priorRec.git?.sha ?? null,
      branch: priorRec.git?.branch ?? null,
      author: priorRec.author,
    },
    whatChanged,
    rows,
    unchanged,
  }
}

function buildChoices(e: EvalEntry): ChoiceBreakdown[] {
  return attemptAnswerRows(e)
    .filter((r) => r.choices && r.choices.length >= 2)
    .map((r) => {
      const options = [...(r.choices ?? [])]
        .map((c) => ({ label: c.choice, count: c.n }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      const noPick = r.answers.filter((a) => !a.choice).length
      const byKey = new Map<
        string,
        {
          arm: string | null
          prompt: string | null
          harness: string
          counts: Record<string, number>
          attempts: number
        }
      >()
      for (const ans of r.answers) {
        const attempt = e.attempts.find((a) => a.id === ans.attempt)
        if (!attempt) continue
        const cell = cellOf(e, attempt.cell)
        const harness = cell?.harness ?? attempt.cell
        const arm = cell?.environment ?? null
        const key = `${arm ?? ''}\0${harness}`
        const row = byKey.get(key) ?? {
          arm,
          prompt: null,
          harness,
          counts: Object.fromEntries(options.map((o) => [o.label, 0])),
          attempts: 0,
        }
        row.attempts++
        if (ans.choice && row.counts[ans.choice] !== undefined) row.counts[ans.choice]!++
        byKey.set(key, row)
      }
      const rows = [...byKey.values()].map((row) => ({
        ...row,
        picks: options.map((o) => ({
          option: o.label,
          k: row.counts[o.label] ?? 0,
          n: row.attempts,
        })),
        text: options.map((o) => `${o.label} ${row.counts[o.label] ?? 0}`).join(', '),
      }))
      return {
        question: r.question,
        options,
        noPick,
        rows,
        passByPick: options.map((o) => {
          const picked = r.answers.filter((a) => a.choice === o.label)
          const passed = picked.filter((a) => a.outcome === 'pass').length
          return { option: o.label, rate: rateOf(passed, picked.length) }
        }),
      }
    })
}

const SKILL_SOURCES = ['placed', 'skill-dir', 'elsewhere'] as const

/**
 * The skill an attempt's first passing `toHaveCalledSkill` (or `poll.`, `resolves.` … but not a
 * `not.`) checked, read from its default label: the matcher as recorded, the skill, then any ` #n`
 * that keeps the label unique. Undefined when every such call had a label of its own, which
 * doesn't name the skill.
 */
function checkedSkill(a: AttemptRecord): string | undefined {
  for (const x of a.assertions ?? []) {
    const parts = x.matcher.split('.')
    if (parts.at(-1) !== 'toHaveCalledSkill' || parts.includes('not')) continue
    if (x.status !== 'pass' || x.labelled || !x.label.startsWith(`${x.matcher} `)) continue
    const name = x.label.slice(x.matcher.length + 1).replace(/(?: #\d+)+$/, '')
    if (name) return name
  }
  return undefined
}

/**
 * How many of `attempts` (each found the skill) used the skill it checked from each source, by its
 * first use in their facts: one source an attempt, so the counts sum to at most the attempts.
 */
function skillSources(
  attempts: AttemptRecord[],
  facts: ReadonlyMap<string, AttemptFacts> | undefined,
): DiscoveryRate['sources'] {
  if (!facts) return []
  const counts = new Map<string, number>()
  for (const a of attempts) {
    const name = checkedSkill(a)
    if (name === undefined) continue
    const first = facts
      .get(a.key)
      ?.skills.filter((s) => s.skill === name || s.skill.endsWith(`:${name}`))
      .sort((x, y) => x.firstLine - y.firstLine)[0]
    if (first) counts.set(first.source, (counts.get(first.source) ?? 0) + 1)
  }
  return SKILL_SOURCES.flatMap((source) => {
    const count = counts.get(source) ?? 0
    return count > 0 ? [{ source, count }] : []
  })
}

function buildDiscovery(
  e: EvalEntry,
  facts: ReadonlyMap<string, AttemptFacts> | undefined,
): DiscoveryRate[] {
  if (e.compare) return []
  const matchers = [
    { what: 'skill', matcher: 'toHaveCalledSkill' },
    { what: 'MCP tool', matcher: 'toHaveCalledMcp' },
    { what: 'web fetch', matcher: 'toHaveFetched' },
  ]
  const out: DiscoveryRate[] = []
  for (const m of matchers) {
    const attempts = e.attempts.filter((a) => countedOutcome(a.outcome))
    const foundAttempts = attempts.filter((a) =>
      (a.assertions ?? []).some((x) => x.matcher.includes(m.matcher) && x.status === 'pass'),
    )
    if (
      !foundAttempts.length &&
      !attempts.some((a) => (a.assertions ?? []).some((x) => x.matcher.includes(m.matcher)))
    ) {
      continue
    }
    const applicable = attempts.filter((a) =>
      (a.assertions ?? []).some((x) => x.matcher.includes(m.matcher)),
    )
    if (!applicable.length) continue
    out.push({
      what: m.what,
      matcher: m.matcher,
      found: countOf(foundAttempts.length, applicable.length),
      rows: [...new Set(e.cells.map((c) => c.harness))].map((h) => {
        const pool = applicable.filter((a) => cellOf(e, a.cell)?.harness === h)
        const found = pool.filter((a) =>
          (a.assertions ?? []).some((x) => x.matcher.includes(m.matcher) && x.status === 'pass'),
        )
        return { keys: [h], found: countOf(found.length, pool.length) }
      }),
      sources: m.what === 'skill' ? skillSources(foundAttempts, facts) : [],
    })
  }
  return out
}

function buildJudgments(
  e: EvalEntry,
  ids: AttemptIdMap,
  record: RunRecord,
): JudgmentBreakdown | null {
  const scores = e.attempts.flatMap((a) => {
    const cell = cellOf(e, a.cell)
    return labeledJudgments(a).map((j) => ({
      ...j,
      attempt: a,
      keys: [cell?.harness ?? a.cell, cell?.environment ?? ''].filter(Boolean),
    }))
  })
  if (!scores.length && !(e.answers ?? []).length) return null
  const byLabel = new Map<string, typeof scores>()
  for (const s of scores) {
    const list = byLabel.get(s.label) ?? []
    list.push(s)
    byLabel.set(s.label, list)
  }
  const hasArms = e.cells.some((c) => Boolean(c.environment))
  const judgeRows = [...byLabel.entries()].map(([label, rows]) => {
    const values = rows.map((r) => r.judgment.score)
    const spread = spreadOf(values, (n) => n.toFixed(2))!
    const assertion = rows[0]!.check ?? null
    // No `toPass` assertion: diagnostic. Omit threshold tally even if the call scored one.
    const threshold = assertion === null ? null : (rows[0]!.judgment.threshold ?? null)
    return {
      label,
      question: rows[0]!.judgment.question,
      assertion,
      threshold,
      keys: hasArms ? ['Coding harness', 'Arm'] : ['Coding harness'],
      spread,
      atOrAbove:
        threshold === null
          ? null
          : countOf(values.filter((v) => v >= threshold).length, values.length),
      scores: rows.flatMap((r): JudgeScore[] => {
        const id = ids.get(r.attempt.key)
        if (!id || r.attempt.outcome === 'skipped') return []
        return [
          {
            attempt: id,
            key: r.attempt.key,
            keys: r.keys,
            score: r.judgment.score,
            verdict: r.judgment.verdict,
            outcome: indexOutcome(r.attempt, record),
          },
        ]
      }),
    }
  })
  // Pairwise from eval.answers: rates only; attempt cites need PairVote.attempts (newer records).
  const pairwise: JudgmentBreakdown['pairwise'] = []
  for (const ans of e.answers ?? []) {
    const ties = ans.votes.filter((v) => v.winner === 'tie').length
    for (const cut of ['within', 'across'] as const) {
      const rates = ans.rates.filter((r) => r.cut === cut)
      if (rates.length !== 2) {
        for (const r of rates) {
          pairwise.push({
            question: ans.question,
            cut,
            a: r.name,
            b: 'rest',
            aWins: r.wins,
            bWins: Math.max(0, r.n - r.wins),
            ties,
            pairs: r.n,
            reasons: [],
          })
        }
        continue
      }
      const [a, b] = rates
      if (!a || !b) continue
      pairwise.push({
        question: ans.question,
        cut,
        a: a.name,
        b: b.name,
        aWins: a.wins,
        bWins: b.wins,
        ties,
        pairs: Math.max(a.n, b.n),
        reasons: [],
      })
    }
  }
  return {
    axes: hasArms ? ['Coding harness', 'Arm'] : ['Coding harness'],
    scores: judgeRows,
    pairwise,
  }
}

function buildQualitative(
  e: EvalEntry,
  ids: AttemptIdMap,
  linkBase: string | undefined,
  hrefs: Set<string>,
  hrefByKey: Map<string, string>,
): QualitativeAnswers[] {
  return attemptAnswerRows(e)
    .filter((r) => !r.choices)
    .map((r) => {
      const entries: Quote[] = []
      for (const ans of r.answers) {
        if (!ans.text.trim()) continue
        const attempt = e.attempts.find((a) => a.id === ans.attempt)
        if (!attempt) continue
        const ref = attemptRef(ids, e, attempt, linkBase, hrefs, hrefByKey)
        if (!ref) continue
        const cell = cellOf(e, attempt.cell)
        entries.push({
          text: ans.text.slice(0, 400),
          attempt: ref,
          harness: cell?.harness ?? attempt.cell,
          arm: cell?.environment ?? null,
          case: attempt.case ? caseName(e, { key: attempt.case, name: undefined }) : null,
          input: ans.input ? withBase(linkBase, ans.input) : null,
        })
      }
      return {
        question: r.question,
        answered: countOf(entries.length, r.answers.length),
        themes: null,
        entries,
      }
    })
}

function buildCaptures(
  e: EvalEntry,
  ids: AttemptIdMap,
  linkBase: string | undefined,
  hrefs: Set<string>,
  hrefByKey: Map<string, string>,
  pages?: ReadonlyMap<string, CapturePageFile>,
): CaptureGallery | null {
  const rows = new Map<
    string,
    {
      harness: string
      arm: string | null
      case: string | null
      shots: CaptureGallery['rows'][number]['shots']
    }
  >()
  for (const a of e.attempts) {
    const arts = a.files.artifacts ?? []
    if (!arts.length) continue
    const ref = attemptRef(ids, e, a, linkBase, hrefs, hrefByKey)
    if (!ref) continue
    const cell = cellOf(e, a.cell)
    const key = `${cell?.harness ?? ''}\0${cell?.environment ?? ''}\0${a.case ?? ''}`
    const row = rows.get(key) ?? {
      harness: cell?.harness ?? a.cell,
      arm: cell?.environment ?? null,
      case: a.case ?? null,
      shots: [],
    }
    for (const art of arts) {
      const pagePath = art.capture?.page?.path
      const page = pagePath ? pages?.get(pagePath) : undefined
      row.shots.push({
        name: art.name,
        href: captureHref(art.path, linkBase),
        meta:
          page?.finalUrl ??
          (art.capture?.instructions?.length
            ? art.capture.instructions.join('; ')
            : (art.capture?.path ?? null)),
        attempt: ref,
        status: art.capture?.status ?? page?.status ?? null,
        pageErrors: art.capture?.pageErrors ?? page?.errors.length ?? null,
        consoleErrors:
          (art.capture as { consoleErrors?: number } | undefined)?.consoleErrors ??
          page?.console.filter((c) => c.level === 'error').length ??
          null,
      })
    }
    rows.set(key, row)
  }
  if (!rows.size) return null
  return { rows: [...rows.values()] }
}

function buildFailures(
  e: EvalEntry,
  ids: AttemptIdMap,
  linkBase: string | undefined,
  hrefs: Set<string>,
  hrefByKey: Map<string, string>,
  remarks: RunRemarks | null,
): FailureClusters | null {
  const counted = e.attempts.filter((a) => countedOutcome(a.outcome) || a.outcome === 'infra_error')
  const clusters = new Map<string, FailureClusters['clusters'][number]>()
  const add = (
    kind: FailureClusters['clusters'][number]['kind'],
    label: string,
    at: string | null,
    attempt: AttemptRecord,
    message?: string,
    text?: string,
    cause?: FailureClusters['clusters'][number]['cause'],
  ) => {
    const ref = attemptRef(ids, e, attempt, linkBase, hrefs, hrefByKey)
    if (!ref) return
    const key = `${kind}\0${cause ?? ''}\0${label}\0${at ?? ''}`
    const existing = clusters.get(key)
    if (existing) {
      existing.attempts.push(ref)
      existing.count = countOf(existing.attempts.length, counted.length)
      return
    }
    clusters.set(key, {
      kind,
      ...(cause ? { cause } : {}),
      label,
      at,
      ...(message ? { message } : {}),
      ...(text && detailOf(text) ? { detail: detailOf(text) as string } : {}),
      count: countOf(1, counted.length),
      attempts: [ref],
    })
  }
  for (const a of e.attempts) {
    let failedAssertion = false
    // An infra error's checks failed for the infrastructure, which is its own cluster.
    for (const x of a.outcome === 'infra_error' ? [] : (a.assertions ?? [])) {
      if (x.status !== 'fail') continue
      failedAssertion = true
      const own = x.message ?? ''
      const message =
        own && a.error?.kind === 'assertion' && a.error.message.startsWith(own)
          ? a.error.message
          : own
      add('assertion', x.label, x.at ?? null, a, messageLine(message), message)
    }
    let turnError = false
    for (const t of a.turns) {
      if (t.status === 'error' && t.error) {
        turnError = true
        add('turn-error', messageLine(t.error), null, a)
      }
    }
    // The failed `expect` that ended the body, and the turn error an attempt was reclassified
    // for, are already their own clusters.
    if (a.outcome === 'infra_error' && a.error) {
      if (!(a.error.turn && turnError)) {
        add('infra-error', messageLine(a.error.message), null, a, undefined, a.error.message)
      }
    } else if (
      a.error &&
      a.outcome === 'fail' &&
      !((a.error.kind === 'assertion' || a.error.kind === 'judge') && failedAssertion)
    ) {
      const cause =
        a.error.kind === 'timeout' ? 'timeout' : a.error.kind === 'aborted' ? 'canceled' : undefined
      add('error', messageLine(a.error.message), null, a, undefined, a.error.message, cause)
    }
  }
  // A remark that names an edit prints it under Next, so its line here is the finding alone.
  const evalRemarks = concernsOf(e, remarks).map((r) => ({
    kind: r.kind,
    severity: r.severity,
    text: r.text,
    fix: r.fix,
    line: r.fix?.edit ? r.text : remarkLine(r),
  }))
  if (!clusters.size && !evalRemarks.length) return null
  return {
    clusters: [...clusters.values()].sort((a, b) => b.count.k - a.count.k),
    remarks: evalRemarks,
  }
}

// Remark.evalId is the suite fact path (`factSegment(id)`); evalKey is EvalEntry.key when set.
// Summary keeps concerns only (CLI `Remarks:` without `-v`); suggestions stay out of Worth knowing.
/** A failure's lines past its first, without blank lines or empty `--- stderr ---` blocks. */
function detailOf(text: string): string | null {
  const lines = text
    .split('\n')
    .slice(1)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '')
  const header = (l: string | undefined) => l !== undefined && /^--- [\w ]+ ---$/.test(l.trim())
  const kept = lines.filter(
    (l, i) => !(header(l) && (i === lines.length - 1 || header(lines[i + 1]))),
  )
  return kept.join('\n') || null
}

function concernsOf(e: EvalEntry, remarks: RunRemarks | null) {
  const evalPath = factSegment(e.id)
  return (
    remarks?.remarks.filter(
      (r) =>
        r.severity === 'concern' &&
        (r.evalKey === e.key || r.evalId === e.id || r.evalId === e.key || r.evalId === evalPath),
    ) ?? []
  )
}

function unansweredOf(e: EvalEntry): Pick<EvalSection, 'unanswered'> {
  const unanswered: NonNullable<EvalSection['unanswered']> = []
  for (const a of e.answers ?? []) {
    if (a.error !== undefined) {
      unanswered.push({ question: a.question, text: `The model call failed: ${a.error}` })
    }
  }
  for (const row of attemptAnswerRows(e)) {
    const failed = row.answers.filter((a) => a.error !== null)
    if (!failed.length) continue
    unanswered.push({
      question: row.question,
      text: `${failed.length} of ${row.answers.length} not answered: ${failed[0]?.error}`,
    })
  }
  return unanswered.length ? { unanswered } : {}
}

function nextOf(e: EvalEntry, remarks: RunRemarks | null): { next?: NextStep[] } {
  const next: NextStep[] = concernsOf(e, remarks).flatMap((r) =>
    r.fix?.edit
      ? [{ kind: r.kind, text: r.fix.edit, at: r.fix.at ? remarkLocation(r.fix.at) : null }]
      : [],
  )
  return next.length ? { next } : {}
}

function fillTextLeadCites(
  primary: HeadlinePrimary,
  e: EvalEntry,
  ids: AttemptIdMap,
  linkBase: string | undefined,
  hrefs: Set<string>,
  hrefByKey: Map<string, string>,
): HeadlinePrimary {
  if (primary.kind !== 'text' || !primary.lead) return primary
  const answers = attemptAnswerRows(e).find((r) => r.question === primary.question)
  const first = answers?.answers.find((a) => a.text.trim())
  const attempt = first && e.attempts.find((a) => a.id === first.attempt)
  const ref = attempt && attemptRef(ids, e, attempt, linkBase, hrefs, hrefByKey)
  // A quote is shown only with a citation it can link to.
  if (!ref) return { ...primary, lead: null, leadRole: null }
  return { ...primary, lead: { ...primary.lead, attempt: ref } }
}

function buildEvalSection(ctx: Ctx, e: EvalEntry, displayName: string): EvalSection {
  const arms = armsOf(e)
  const shapes = shapesOf(e, Boolean(ctx.prior))
  const design = designOf(e)
  const regression = ctx.prior ? buildRegression(ctx.prior) : null
  const metricCfg = resolveMetric(e, ctx.record, ctx.metric)
  const chosen = chooseHeadline(e, arms, ctx.prior, regression, metricCfg)
  const primaryHeadline = fillTextLeadCites(
    chosen.primary,
    e,
    ctx.ids,
    ctx.linkBase,
    ctx.hrefs,
    ctx.hrefByKey,
  )
  const headline: EvalHeadline = {
    task: displayName,
    kicker: chosen.kicker,
    fairness: chosen.fairness,
    primary: primaryHeadline,
    foot: chosen.foot,
    ...(chosen.saturated ? { saturated: true } : {}),
  }
  let primary: EvalSection['primary'] = null
  if (regression) primary = regression
  else if (e.compare && isPassFailEval(e)) primary = buildVariantComparison(e, arms, metricCfg)
  else primary = buildTaskResults(e, metricCfg)

  const insights: ReportClaim[] = []
  if (ctx.analysis) {
    const body = ctx.analysis.analysis
    for (const claim of [...body.whatHappened, ...body.results, ...body.why]) {
      insights.push({
        role: 'finding',
        text: claim.text,
        confidence: claim.confidence,
        cites: [],
        action: null,
      })
    }
    for (const anomaly of body.anomalies) {
      insights.push({
        role: 'caveat',
        text: anomaly.text,
        confidence: 'medium',
        cites: [],
        action: null,
      })
    }
  }

  return {
    id: e.key,
    anchor: gfmAnchor(displayName),
    name: displayName,
    group: e.group,
    state: e.todo
      ? 'todo'
      : notRunYet(ctx.record, e)
        ? 'not-run'
        : e.skip || e.outcome === 'skipped'
          ? 'skipped'
          : e.attempts.some((a) => a.outcome !== 'skipped')
            ? 'ran'
            : 'not-run',
    outcome: e.outcome,
    file: e.file,
    shapes,
    design,
    headline,
    insights,
    primary,
    choices: buildChoices(e),
    discovery: buildDiscovery(e, ctx.facts),
    judgments: buildJudgments(e, ctx.ids, ctx.record),
    qualitative: buildQualitative(e, ctx.ids, ctx.linkBase, ctx.hrefs, ctx.hrefByKey),
    ...unansweredOf(e),
    captures: buildCaptures(e, ctx.ids, ctx.linkBase, ctx.hrefs, ctx.hrefByKey, ctx.pages),
    failures: buildFailures(e, ctx.ids, ctx.linkBase, ctx.hrefs, ctx.hrefByKey, ctx.remarks),
    ...nextOf(e, ctx.remarks),
    ...suggestionsOf(e, ctx.remarks),
    ...notesOf(e),
  }
}

function notesOf(e: EvalEntry): { notes?: string[]; observed?: string[] } {
  const counted = e.attempts.filter((a) => a.outcome === 'pass' || a.outcome === 'fail')
  const tries = new Map<string, string[]>()
  for (const a of counted) {
    for (const [label, check] of checksByLabel(a)) {
      const note = checkTries(check)
      if (note) tries.set(label, [...(tries.get(label) ?? []), note])
    }
  }
  const retried = [...tries].map(([label, notes]) => {
    const flat = label.replace(/\s*\n\s*/g, ' ')
    return counted.length === 1
      ? `"${flat}" ${notes[0]}.`
      : `"${flat}" retried in ${notes.length} of ${counted.length} attempts.`
  })
  const [first, ...rest] = counted.flatMap((a) =>
    (a.files.artifacts ?? []).flatMap(({ name, capture }) =>
      capture?.pageErrors && capture.page
        ? [{ name, errors: capture.pageErrors, path: capture.page.path }]
        : [],
    ),
  )
  const pageErrors = first
    ? [
        `${first.errors} page error${first.errors === 1 ? '' : 's'} in capture "${first.name}", listed in ${first.path}${
          rest.length ? ` (+${rest.length} more capture${rest.length === 1 ? '' : 's'})` : ''
        }`,
      ]
    : []
  const notes = [...retried, ...pageErrors]
  const tallies = observedTallies(counted)
  const perCell = new Set(tallies.map((t) => t.cell)).size > 1
  const byArm = new Set(e.cells.map((c) => c.environment)).size > 1
  const who = (key: string) => {
    const cell = e.cells.find((c) => c.key === key)
    return cell ? (byArm ? cell.environment : cell.harness) : key
  }
  const observed = tallies.map(
    (t) => `${t.name}${perCell ? ` on ${who(t.cell)}` : ''}: ${observedLine(t)}`,
  )
  return {
    ...(notes.length ? { notes } : {}),
    ...(observed.length ? { observed } : {}),
  }
}

function suggestionsOf(e: EvalEntry, remarks: RunRemarks | null): { suggestions?: string[] } {
  const evalPath = factSegment(e.id)
  const suggestions = (remarks?.remarks ?? [])
    .filter(
      (r) =>
        r.severity === 'suggestion' &&
        (r.evalKey === e.key || r.evalId === e.id || r.evalId === e.key || r.evalId === evalPath),
    )
    .map((r) => remarkLine(r))
  return suggestions.length ? { suggestions } : {}
}

function buildIntegrity(ctx: Ctx): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []
  const { record, evals, ids, linkBase } = ctx
  if (record.status !== 'complete') {
    issues.push({
      kind: 'run-incomplete',
      severity: 'error',
      text: `Run stopped early (${record.status}); pass rates and medians cover only the attempts that finished.`,
      evalId: null,
      cites: [],
    })
  }
  if (record.git?.dirty) {
    issues.push({
      kind: 'dirty-worktree',
      severity: 'warn',
      text: 'The worktree was dirty; an exact rerun needs the saved worktree patch.',
      evalId: null,
      cites: [],
    })
  }
  for (const e of evals) {
    const cites: AttemptRef[] = []
    for (const a of e.attempts) {
      const turnErr = a.turns.some((t) => t.status === 'error')
      if (!turnErr) continue
      const ref = attemptRef(ids, e, a, linkBase, ctx.hrefs, ctx.hrefByKey)
      if (ref) cites.push(ref)
    }
    if (cites.length) {
      issues.push({
        kind: 'turn-error',
        severity: 'error',
        text: `${cites.length} attempt${cites.length === 1 ? '' : 's'} had a mid-turn error; those outcomes may not reflect a finished agent turn.`,
        evalId: e.key,
        cites,
      })
    }
    const envNames = new Map<string, Set<string>>()
    for (const c of e.cells) {
      const set = envNames.get(c.environment) ?? new Set()
      set.add(c.environmentDigest ?? c.environment)
      envNames.set(c.environment, set)
    }
    for (const [name, digests] of envNames) {
      if (digests.size > 1) {
        issues.push({
          kind: 'duplicate-environment',
          severity: 'warn',
          text: `Environment name "${name}" maps to ${digests.size} digests; arm labels include the digest prefix.`,
          evalId: e.key,
          cites: [],
        })
      }
    }
    if (e.compare) {
      const harnessesByCheck = new Map<string, Set<string>>()
      for (const c of e.cells.filter((x) => x.role === 'control')) {
        for (const check of c.checks ?? []) {
          const answered = check.pass + check.fail
          if (answered > 0 && check.pass === 0) {
            const variant = e.cells.find(
              (v) =>
                v.role === 'variant' &&
                v.harness === c.harness &&
                v.sandbox === c.sandbox &&
                (v.checks ?? []).some(
                  (k) => k.label === check.label && k.pass === k.pass + k.fail && k.pass > 0,
                ),
            )
            if (variant) {
              const harnesses = harnessesByCheck.get(check.label) ?? new Set()
              harnesses.add(c.harness)
              harnessesByCheck.set(check.label, harnesses)
            }
          }
        }
      }
      const allHarnesses = new Set(e.cells.map((c) => c.harness)).size
      for (const [label, harnesses] of harnessesByCheck) {
        const on =
          allHarnesses > 1
            ? harnesses.size === allHarnesses
              ? ' on every coding harness'
              : ` on coding harness${harnesses.size === 1 ? '' : 'es'} ${[...harnesses].join(', ')}`
            : ''
        issues.push({
          kind: 'baseline-never-passes',
          severity: 'warn',
          text: `Check "${label}" never passes on the baseline and always passes on a variant${on}; it may not apply to the baseline.`,
          evalId: e.key,
          cites: [],
        })
      }
    }
    const unreported = e.attempts.filter((a) => countedOutcome(a.outcome) && !a.usage)
    if (unreported.length) {
      issues.push({
        kind: 'unreported-usage',
        severity: 'warn',
        text: `${unreported.length} counted attempt${unreported.length === 1 ? '' : 's'} reported no token usage; token medians omit them.`,
        evalId: e.key,
        cites: unreported.flatMap((a) => {
          const ref = attemptRef(ids, e, a, linkBase, ctx.hrefs, ctx.hrefByKey)
          return ref ? [ref] : []
        }),
      })
    }
    const preHits = e.attempts.flatMap((a) =>
      (a.assertions ?? [])
        .filter((x) => x.preSatisfied)
        .map((x) => ({ attempt: a, label: x.label })),
    )
    if (preHits.length) {
      const labels = [...new Set(preHits.map((h) => h.label))]
      issues.push({
        kind: 'pre-satisfied',
        severity: 'warn',
        text: `${preHits.length} pre-satisfied check${preHits.length === 1 ? '' : 's'} (${labels.join(', ')}); existing workspace state may satisfy them without agent work.`,
        evalId: e.key,
        cites: preHits.flatMap((h) => {
          const ref = attemptRef(ids, e, h.attempt, linkBase, ctx.hrefs, ctx.hrefByKey)
          return ref ? [ref] : []
        }),
      })
    }
  }
  if (ctx.prior) {
    const sampleNs = ctx.prior.rows.flatMap((row) =>
      (row.perCell ?? []).map((c) =>
        Math.min(c.base.pass + c.base.fail, c.head.pass + c.head.fail),
      ),
    )
    const gatedTiny = ctx.prior.rows.some(
      (row) =>
        (row.status === 'regressed' || row.status === 'fixed') &&
        Boolean(row.gate) &&
        (row.perCell ?? []).some(
          (c) => Math.min(c.base.pass + c.base.fail, c.head.pass + c.head.fail) < COMPARE_RUNS,
        ),
    )
    if (gatedTiny || (sampleNs.length && Math.min(...sampleNs) < COMPARE_RUNS)) {
      const minN = sampleNs.length ? Math.min(...sampleNs) : 0
      issues.push({
        kind: 'fairness-floor',
        severity: 'warn',
        text: `A gated regression claim rests on fewer than ${COMPARE_RUNS} counted attempts per side${minN ? ` (as low as ${minN})` : ''}; treat worse/fixed as provisional.`,
        evalId: null,
        cites: [],
      })
    }
  }
  return mergeIssues(issues)
}

/** One issue per kind, eval and sentence, its cites merged in order. */
function mergeIssues(issues: IntegrityIssue[]): IntegrityIssue[] {
  const byId = new Map<string, IntegrityIssue>()
  for (const issue of issues) {
    const id = `${issue.kind}\0${issue.evalId ?? ''}\0${issue.text}`
    const seen = byId.get(id)
    if (!seen) {
      byId.set(id, { ...issue, cites: [...issue.cites] })
      continue
    }
    for (const cite of issue.cites) {
      if (!seen.cites.some((c) => c.key === cite.key)) seen.cites.push(cite)
    }
  }
  return [...byId.values()]
}

function buildRoster(evals: EvalEntry[], record: RunRecord): RosterRow[] {
  if (evals.length < 2) return []
  const harnesses = record.stack.harnesses
  if (harnesses.length < 2) return []
  return harnesses.map((h) => {
    const attempts = evals.flatMap((e) =>
      e.attempts.filter((a) => cellOf(e, a.cell)?.harness === h.id && ranAttempt(a)),
    )
    const gateways = [
      ...new Set(
        evals.flatMap((e) =>
          e.cells
            .filter((c) => c.harness === h.id)
            .map((c) => c.gateway)
            .filter(Boolean),
        ),
      ),
    ] as string[]
    return {
      harness: h.id,
      model: h.model ?? null,
      effort: h.effort ?? null,
      servedModels: h.resolvedModels ?? [],
      gateway: gateways[0] ?? null,
      attempts: attempts.length,
    }
  })
}

function buildRollup(
  sections: EvalSection[],
  analysis: AnalysisDoc | null,
): ExecutiveRollup | null {
  if (sections.length < 2 && !analysis?.analysis.tldr) return null
  const lead: ReportClaim | null = analysis?.analysis.tldr
    ? {
        role: 'finding',
        text: analysis.analysis.tldr,
        confidence: analysis.analysis.confidence.overall,
        cites: [],
        action: null,
      }
    : null
  const findings: ReportClaim[] = analysis
    ? [...analysis.analysis.whatHappened, ...analysis.analysis.results].map((c) => ({
        role: 'finding' as const,
        text: c.text,
        confidence: c.confidence,
        cites: [],
        action: null,
      }))
    : []
  return {
    lead,
    rows: sections.map((s) => {
      const result = headlineResultOf(s.headline.primary)
      return {
        evalId: s.id,
        name: s.name,
        anchor: s.anchor,
        shapes: s.shapes,
        design: s.design,
        primary: headlineResultText(result),
        result,
        medianTokens: rollupTokens(s),
        ...(s.primary?.kind === 'comparison'
          ? {
              medianTokensByArm: s.primary.summary.map((r) => ({
                arm: r.arm,
                tokens: r.measures.tokens?.value?.median ?? tokensFigure(null),
              })),
            }
          : {}),
      }
    }),
    findings,
  }
}

function rollupTokens(s: EvalSection): Figure {
  if (s.headline.primary.kind === 'measure' && s.headline.primary.unit === 'tokens') {
    return s.headline.primary.spread.median
  }
  if (s.primary && 'breakdown' in s.primary) {
    return tokensFigure(
      s.primary.median?.measures.tokens?.median.value ??
        s.primary.breakdown[0]?.measures.tokens?.median.value ??
        null,
    )
  }
  return tokensFigure(null)
}

function buildActions(analysis: AnalysisDoc | null): ReportClaim[] {
  if (!analysis) return []
  return analysis.analysis.actions.map((a) => ({
    role: 'action' as const,
    text: a.title,
    confidence: analysis.analysis.confidence.overall,
    cites: [],
    action: {
      kind: a.kind,
      target: a.target,
      change: a.change,
      verify: a.verify,
    },
  }))
}

function buildAttemptIndex(ctx: Ctx): AttemptIndexRow[] {
  const { evals, ids, linkBase, record, hrefByKey } = ctx
  const rows: AttemptIndexRow[] = []
  for (const e of evals) {
    for (const a of e.attempts) {
      if (!ranAttempt(a)) continue
      const id = ids.get(a.key)
      if (!id) continue
      const cell = cellOf(e, a.cell)
      const href = hrefByKey.get(a.key) ?? attemptHref(e, a, linkBase, ctx.hrefs)
      const diffStats = attemptDiffStats(a)
      const reclassified =
        a.outcome === 'infra_error' &&
        ((a as { turnStatusRead?: boolean }).turnStatusRead === false ||
          ((a as { turnStatusRead?: boolean }).turnStatusRead === undefined &&
            a.turns.some((t) => t.status === 'error')))
      rows.push({
        id,
        key: a.key,
        evalId: e.key,
        harness: cell?.harness ?? a.cell,
        arm: cell?.environment ?? null,
        case: a.case ?? null,
        outcome: indexOutcome(a, record),
        reclassified,
        turnError: turnErrorMessage(a),
        gated: cell ? cell.gate !== 'none' : true,
        failed: (a.assertions ?? [])
          .filter((x) => x.status === 'fail')
          .map((x) => ({
            label: x.label,
            at: x.at ?? null,
            message: messageLine(x.message ?? ''),
          })),
        error: a.error ? { kind: a.error.kind, message: messageLine(a.error.message) } : null,
        cost: a.cost
          ? { usd: a.cost.usd, text: usdFigure(a.cost.usd).text, basis: a.cost.basis }
          : null,
        answers: (a.answers ?? []).map((q) => ({
          question: q.question,
          model: q.resolvedModel ?? q.model,
          choice: q.choice ?? null,
          text: q.text,
          error: q.error ?? null,
        })),
        tokens: tokensFigure(a.usage ? totalTokens(a.usage) : null),
        agentMs: durationFigure(a.timings.agentMs),
        toolCalls: countFigure(a.activity.tools),
        usage: a.usage
          ? {
              input: a.usage.input,
              output: a.usage.output,
              cacheRead: a.usage.cacheRead,
              cacheWrite: a.usage.cacheWrite,
              reasoning: a.usage.reasoning,
            }
          : null,
        time: {
          setupMs: a.timings.setupMs,
          agentMs: a.timings.agentMs,
          diffMs: a.timings.diffMs,
          checksMs: a.timings.checksMs,
          judgeMs: a.timings.judgeMs,
          agent: a.timeSplit
            ? {
                modelMs: a.timeSplit.modelMs,
                toolMs: a.timeSplit.toolMs,
                waitingMs: a.timeSplit.waitingMs,
                otherMs: a.timeSplit.otherMs,
              }
            : null,
        },
        judgments: labeledJudgments(a).map((j) => ({
          label: j.label,
          score: j.judgment.score,
          threshold: j.judgment.threshold,
          verdict: j.judgment.verdict,
          gated: j.check !== undefined,
        })),
        ...(ctx.facts?.has(a.key) ? { facts: ctx.facts.get(a.key) } : {}),
        diff:
          diffStats.files === 0 && diffStats.added === null
            ? null
            : {
                files: diffStats.files,
                added: diffStats.added,
                removed: diffStats.removed,
                text:
                  diffStats.added === null || diffStats.removed === null
                    ? `${plural(diffStats.files, 'file')} (lines not recorded)`
                    : `${plural(diffStats.files, 'file')}, ${diffLinesText(diffStats.added, diffStats.removed)}`,
              },
        links: {
          transcript: a.files.transcript ? withBase(linkBase, a.files.transcript.path) : null,
          diff: a.files.diff ? withBase(linkBase, a.files.diff.path) : null,
          captures: (a.files.artifacts ?? []).map((art) => ({
            name: art.name,
            href: withBase(linkBase, art.path),
          })),
          questions: (a.answers ?? [])
            .map((q) => q.input?.path)
            .filter((p): p is string => Boolean(p))
            .map((p) => withBase(linkBase, p)),
          ...snapshotOf(a, linkBase),
        },
        href,
      })
    }
  }
  return rows.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
}

function recordedRemarks(record: RunRecord): RunRemarks | null {
  if (!record.remarks?.length) return null
  return {
    kind: 'reeval-remarks',
    schemaVersion: 1,
    runId: record.runId,
    createdAt: record.endedAt,
    remarks: record.remarks,
  }
}

/** The only reader of a `RunRecord` for a report. Pure and deterministic. */
function snapshotOf(a: AttemptRecord, linkBase: string | undefined): { snapshot?: string } {
  const path = a.snapshots?.find((s) => s.name === 'final')?.path
  return path ? { snapshot: withBase(linkBase, path) } : {}
}

export function buildRunReport(record: RunRecord, options: RunReportOptions = {}): RunReport {
  const evals = selectedEvals(record, options.evals)
  if (evals.length === 0) {
    throw new Error('buildRunReport: no evals selected')
  }
  const names = uniqueEvalNames(evals)
  const ids = attemptIds(record, new Set(evals.map((e) => e.key)))
  const ctx: Ctx = {
    record,
    evals,
    ids,
    linkBase: options.links?.base,
    remarks: options.remarks ?? recordedRemarks(record),
    analysis: options.analysis ?? null,
    pages: options.pages,
    facts: options.facts,
    prior: options.prior ?? null,
    metric: options.metric,
    hrefs: new Set(),
    hrefByKey: new Map(),
  }
  assignAttemptHrefs(ctx)
  const header = buildHeader(ctx)
  if (options.title) header.title = options.title
  else header.title = runTitle(record, evals)

  const sections = evals.map((e) => buildEvalSection(ctx, e, names.get(e.key) ?? e.name))
  const single = sections.length === 1
  const rollup = buildRollup(sections, ctx.analysis)
  const roster = buildRoster(evals, record)

  return {
    reportVersion: 1,
    runId: record.runId,
    single,
    header,
    integrity: buildIntegrity(ctx),
    rollup: single && !ctx.analysis?.analysis.tldr ? null : rollup,
    roster,
    evals: sections,
    actions: buildActions(ctx.analysis),
    provenance: provenanceState(record, options.links?.record),
    attempts: buildAttemptIndex(ctx),
  }
}
