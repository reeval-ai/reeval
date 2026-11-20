// `present(report)`: the one adapter from a `RunReport` to the presentation. Every rule a surface
// would otherwise apply on its own lives here, once: infra errors, canceled and skipped attempts
// stay out of the denominator (their count prints beside the rate), the environment `-` is the
// `baseline`, harnesses print as `name · model`, and every number is formatted.
import { median } from '../../stats.ts'
import { plural } from '../../text.ts'
import { formatUsd } from '../cost.ts'
import {
  changeSideText,
  figure,
  judgeScoreText,
  MEASURE_TEXT,
  rateOf,
  remarkLine,
  tokensFigure,
  usdFigure,
  wilsonRangeText,
} from '../report/format.ts'
import { attemptAnchorId } from '../report/ids.ts'
import { COMPARE_STATUS_LABEL, contrastMeasureLabel, verdictLabel } from '../report/labels.ts'
import type {
  AttemptIndexRow,
  AttemptRef,
  EvalSection,
  ArmRow as ReportArmRow,
  Rate as ReportRate,
  RunReport,
  VariantComparison,
} from '../report/types.ts'
import { harnessName } from './harness.ts'
import type {
  ArmRow,
  AttemptRow,
  CaseRow,
  CheckRow,
  Cite,
  Count,
  Effect,
  EffortRow,
  EvalPresentation,
  Figure,
  HarnessRow,
  Metric,
  Outcome,
  Question,
  Rate,
  RunPresentation,
  Verdict,
} from './schema.ts'

const NOT_REPORTED = 'not reported'
const NO_PASSES = 'no passing attempts'

const count = (k: number, n: number): Count => ({ k, n, text: `${k} of ${n}` })

function rate(r: ReportRate): Rate {
  return {
    k: r.k,
    n: r.n,
    rate: r.rate,
    text: r.text,
    of: `${r.k} of ${r.n}`,
    interval: r.interval ? wilsonRangeText(r.interval) : null,
  }
}

const rateFor = (k: number, n: number): Rate => rate(rateOf(k, n))

const cite = (ref: AttemptRef): Cite => ({ id: ref.id, href: ref.href })

const VERDICT_TEXT: Record<Verdict, string> = {
  pass: 'pass',
  fail: 'fail',
  ungated: 'not gated',
  'infra-error': 'infra error',
  canceled: 'canceled',
  skipped: 'skipped',
  todo: 'todo',
  'not-run': 'not run',
}

const OUTCOME_TEXT: Record<Outcome, string> = {
  pass: 'pass',
  fail: 'fail',
  'infra-error': 'infra error',
  canceled: 'canceled',
}

const EFFECT: Record<ReportArmRow['verdict'], Effect | null> = {
  baseline: null,
  helped: 'helped',
  'made-worse': 'made-worse',
  'within-noise': 'same',
  'too-few-runs': 'too-few',
}

export const EFFECT_TEXT: Record<Effect, string> = {
  helped: 'helped',
  'made-worse': 'made it worse',
  same: 'same',
  'too-few': 'too few runs',
}

const SHAPE_TEXT: Record<EvalSection['shapes'][number], string> = {
  task: 'Task',
  ab: 'A/B',
  discoverability: 'Discoverability',
  regression: 'Regression',
}

const FAILURE_TEXT = {
  assertion: 'failed check',
  'turn-error': 'turn error',
  'infra-error': 'infra error',
  'capture-error': 'capture error',
  error: 'error',
  timeout: 'timeout',
  canceled: 'canceled',
} as const

const outcomeOf = (a: AttemptIndexRow): Outcome =>
  a.outcome === 'infra_error' ? 'infra-error' : a.outcome

/** `1 infra error, 1 canceled`: what a rate leaves out; null when nothing. */
function leftOut(attempts: readonly AttemptIndexRow[]): string | null {
  const infra = attempts.filter((a) => a.outcome === 'infra_error').length
  const canceled = attempts.filter((a) => a.outcome === 'canceled').length
  const parts = [
    infra ? plural(infra, 'infra error') : null,
    canceled ? `${canceled} canceled` : null,
  ].filter((p): p is string => p !== null)
  return parts.length ? parts.join(', ') : null
}

const counted = (attempts: readonly AttemptIndexRow[]) =>
  attempts.filter((a) => a.outcome === 'pass' || a.outcome === 'fail')

function medianFigure(
  values: Array<number | null | undefined>,
  format: (n: number) => string,
): Figure {
  const known = values.filter((v): v is number => typeof v === 'number')
  const m = median(known)
  return m === null ? figure(null, NOT_REPORTED) : figure(m, format(m))
}

/**
 * Effort over an attempt group: on a pass/fail eval, medians over its passing attempts, as the
 * report's arms take them; cost per pass is every counted attempt's cost over the passes.
 */
function effortOf(label: string, attempts: readonly AttemptIndexRow[], graded: boolean): EffortRow {
  const c = counted(attempts)
  const passing = c.filter((a) => a.outcome === 'pass')
  const pool = graded ? passing : c
  const costOf = (a: AttemptIndexRow) => a.cost?.usd
  const costs = c.map(costOf).filter((v): v is number => typeof v === 'number')
  const total = costs.length ? costs.reduce((x, y) => x + y, 0) : null
  const none = graded && pool.length === 0
  const med = (values: Array<number | null | undefined>, format: (n: number) => string) =>
    none ? figure(null, NO_PASSES) : medianFigure(values, format)
  return {
    label,
    tokens: med(
      pool.map((a) => a.tokens.value),
      MEASURE_TEXT.tokens,
    ),
    toolCalls: med(
      pool.map((a) => a.toolCalls.value),
      MEASURE_TEXT.toolCalls,
    ),
    agentTime: med(
      pool.map((a) => a.agentMs.value),
      MEASURE_TEXT.agentMs,
    ),
    cost: none ? figure(null, NO_PASSES) : medianFigure(pool.map(costOf), formatUsd),
    costPerPass:
      total === null
        ? figure(null, NOT_REPORTED)
        : passing.length === 0
          ? figure(null, NO_PASSES)
          : usdFigure(total / passing.length),
  }
}

type ArmDef = { id: string; env: string; label: string; role: ArmRow['role']; gated: boolean }

const armLabel = (env: string, label: string) => (env === '-' ? 'baseline' : label)

function armDefs(attempts: readonly AttemptIndexRow[], cmp: VariantComparison | null): ArmDef[] {
  if (cmp?.arms.length) {
    return cmp.arms.map((a) => ({
      id: a.id,
      env: a.environment,
      label: armLabel(a.environment, a.label),
      role: a.role,
      gated: a.gated ?? a.role === 'variant',
    }))
  }
  const envs = [...new Set(attempts.map((a) => a.arm ?? ''))]
  if (envs.length <= 1) {
    const env = envs[0] ?? ''
    return [{ id: env, env, label: 'all attempts', role: 'only', gated: true }]
  }
  const baseline = envs.includes('-') ? '-' : (envs[0] as string)
  return [baseline, ...envs.filter((e) => e !== baseline)].map((env) => ({
    id: env,
    env,
    label: armLabel(env, env),
    role: env === baseline ? ('baseline' as const) : ('variant' as const),
    gated: env !== baseline,
  }))
}

/** Where every one of a failure's attempts ran, when they share an arm or a harness the others don't. */
function whereOf(
  refs: readonly AttemptRef[],
  attempts: readonly AttemptIndexRow[],
  defs: readonly ArmDef[],
  label: (id: string) => string,
): string | null {
  const rows = refs.flatMap((r) => attempts.filter((a) => a.key === r.key))
  if (!rows.length) return null
  const arms = new Set(rows.map((a) => a.arm ?? ''))
  if (defs.length > 1 && arms.size === 1) {
    const def = defs.find((d) => d.env === [...arms][0])
    const ungated = rows.every((a) => a.gated === false)
    if (def) return `all on ${def.label}${ungated ? ', not gated' : ''}`
  }
  const harnesses = new Set(rows.map((a) => a.harness))
  if (harnesses.size === 1 && new Set(attempts.map((a) => a.harness)).size > 1) {
    return `all on ${label([...harnesses][0] as string)}`
  }
  return null
}

function armOf(
  def: ArmDef,
  attempts: readonly AttemptIndexRow[],
  row: ReportArmRow | undefined,
  graded: boolean,
): ArmRow {
  const own = attempts.filter((a) => def.role === 'only' || (a.arm ?? '') === def.env)
  const c = counted(own)
  const passed = c.filter((a) => a.outcome === 'pass').length
  const effect = row ? EFFECT[row.verdict] : null
  const effort = effortOf(def.label, own, graded)
  return {
    id: def.id,
    label: def.label,
    role: def.role,
    gated: def.gated,
    rate: row ? rate(row.rate) : rateFor(passed, c.length),
    infraError: own.filter((a) => a.outcome === 'infra_error').length,
    canceled: own.filter((a) => a.outcome === 'canceled').length,
    left: leftOut(own),
    effect,
    effectText: effect
      ? `${EFFECT_TEXT[effect]}${row?.missedMinLift === undefined ? '' : `, not by minLift ${Math.round(row.missedMinLift * 100)}`}`
      : null,
    lift:
      row?.lift && def.role === 'variant'
        ? `${def.label} ${row.lift.text}${row.interval ? ` (95% CI ${row.interval.text})` : ''}`
        : null,
    tokens: effort.tokens,
    agentTime: effort.agentTime,
    cost: effort.cost,
    costPerPass: effort.costPerPass,
  }
}

function verdictOf(s: EvalSection, state: EvalPresentation['state'], attempts: AttemptIndexRow[]) {
  if (state === 'todo') return 'todo'
  if (state === 'skipped') return 'skipped'
  if (state === 'not-run') return 'not-run'
  if (attempts.length && attempts.every((a) => a.outcome === 'canceled')) return 'canceled'
  const ran = attempts.filter((a) => a.outcome === 'pass' || a.outcome === 'fail')
  if (ran.length && ran.every((a) => a.gated === false)) return 'ungated'
  switch (s.outcome) {
    case 'pass':
      return 'pass'
    case 'fail':
      return 'fail'
    case 'infra_error':
      return 'infra-error'
    case 'skipped':
      return 'skipped'
  }
  const gated = attempts.filter((a) => a.gated !== false)
  if (gated.some((a) => a.outcome === 'fail')) return 'fail'
  if (attempts.some((a) => a.outcome === 'infra_error')) return 'infra-error'
  if (attempts.length && attempts.every((a) => a.outcome === 'canceled')) return 'canceled'
  return attempts.some((a) => a.outcome === 'pass') ? 'pass' : 'not-run'
}

function metricOf(
  s: EvalSection,
  state: EvalPresentation['state'],
  attempts: AttemptIndexRow[],
  arms: ArmRow[],
  label: (id: string) => string,
): { metric: Metric; foot: string } {
  if (state !== 'ran') {
    const text = state === 'todo' ? 'todo' : state === 'skipped' ? 'skipped' : 'no attempts ran'
    return { metric: { kind: 'none', text }, foot: '' }
  }
  const hp = s.headline.primary
  if (hp.kind === 'choice') {
    return {
      metric: {
        kind: 'counts',
        question: hp.question,
        options: hp.options.map((o) => ({ label: o.label, count: count(o.count, hp.attempts) })),
      },
      foot: plural(hp.attempts, 'attempt'),
    }
  }
  if (hp.kind === 'text') {
    return {
      metric: {
        kind: 'quote',
        question: hp.question,
        text: hp.lead?.text ?? '',
        cite: hp.lead ? cite(hp.lead.attempt) : null,
      },
      foot: `${hp.answered.text} answered${hp.leadRole === 'representative' ? `, showing 1 of ${hp.answered.k} as representative` : ''}`,
    }
  }
  if (hp.kind === 'regression') {
    return {
      metric: {
        kind: 'changes',
        worse: figure(hp.worse, String(hp.worse)),
        fixed: figure(hp.fixed, String(hp.fixed)),
      },
      foot: s.headline.foot,
    }
  }
  if (counted(attempts).length === 0) {
    return { metric: { kind: 'none', text: 'no counted attempts' }, foot: '' }
  }
  const baseline = arms.find((a) => a.role === 'baseline')
  const variants = arms.filter((a) => a.role === 'variant')
  const headVariant =
    (hp.kind === 'lift' || hp.kind === 'tied-ceiling'
      ? variants.find((v) => v.label === hp.variant.label || v.id === hp.variant.id)
      : undefined) ?? variants[0]
  if (baseline && headVariant) {
    return {
      metric: {
        kind: 'compare',
        baseline: { label: baseline.label, rate: baseline.rate },
        variant: { label: headVariant.label, rate: headVariant.rate },
        effect: headVariant.effect,
        effectText: headVariant.effectText,
      },
      foot: `${baseline.rate.of} vs ${headVariant.rate.of} ${headVariant.rate.n === 1 ? 'attempt' : 'attempts'}`,
    }
  }
  const c = counted(attempts)
  if (c.length || hp.kind === 'pass-rate') {
    const gated = c.filter((a) => a.gated !== false)
    const pool = gated.length ? gated : c
    const r =
      hp.kind === 'pass-rate'
        ? rate(hp.rate)
        : rateFor(pool.filter((a) => a.outcome === 'pass').length, pool.length)
    let value: Figure = figure(r.rate, r.text)
    let metricLabel: string = hp.kind === 'pass-rate' ? hp.outcome : 'passed'
    if (hp.kind === 'pass-rate' && hp.metric === 'task-pass-rate' && hp.taskRate) {
      value = hp.taskRate
      metricLabel = 'task average'
    } else if (hp.kind === 'pass-rate' && hp.metric === 'pass@k' && hp.passAtK) {
      value = hp.passAtK
      metricLabel = `Pass@${hp.k}`
    } else if (hp.kind === 'pass-rate' && hp.metric === 'pass^k' && hp.passHatK) {
      value = hp.passHatK
      metricLabel = `Pass^${hp.k}`
    }
    const harnesses = [...new Set(pool.map((a) => a.harness))]
    const byHarness = harnesses.map((h) => {
      const own = pool.filter((a) => a.harness === h)
      return `${label(h)} ${own.filter((a) => a.outcome === 'pass').length} of ${own.length}`
    })
    return {
      metric: { kind: 'rate', value, label: metricLabel, rate: r },
      foot: [
        `${r.of} ${r.n === 1 ? 'attempt' : 'attempts'}`,
        ...(harnesses.length > 1 ? [byHarness.join(', ')] : []),
      ].join(' · '),
    }
  }
  if (hp.kind === 'judge') {
    return {
      metric: {
        kind: 'score',
        label: hp.label,
        value: hp.spread.median,
        scale: `${hp.scale[0]} to ${hp.scale[1]}`,
      },
      foot: plural(hp.spread.n, 'score'),
    }
  }
  if (hp.kind === 'measure') {
    return {
      metric: { kind: 'median', label: hp.label, value: hp.spread.median },
      foot: plural(hp.spread.n, 'attempt'),
    }
  }
  return { metric: { kind: 'none', text: 'no attempt counted' }, foot: '' }
}

/** A check's message without the label its row already names. */
const withoutLabel = (message: string, label: string) =>
  message.startsWith(`${label}: `) ? message.slice(label.length + 2) : message

const SATURATED =
  'Saturated: every arm hit 100% across all tasks. This comparison catches regressions; add harder tasks to separate variants.'

const saturated = (arms: readonly ArmRow[]) =>
  arms.length > 1 && arms.every((a) => a.rate.n > 0 && a.rate.rate === 1)

function statsOf(s: EvalSection, metric: Metric, arms: ArmRow[]): string[] {
  const out: string[] = []
  if (metric.kind === 'rate' && metric.rate.interval) {
    out.push(`${metric.rate.text} passed, 95% CI ${metric.rate.interval}`)
  }
  for (const a of arms) if (a.lift) out.push(a.lift)
  for (const line of s.suggestions ?? []) out.push(`Suggestion: ${line}`)
  const hp = s.headline.primary
  if (hp.kind === 'pass-rate') {
    if (hp.taskRate) out.push(`task average ${hp.taskRate.text}`)
    if (hp.passAtK) out.push(`Pass@${hp.k} ${hp.passAtK.text}`)
    if (hp.passHatK) out.push(`Pass^${hp.k} ${hp.passHatK.text}`)
    if (hp.passKOmitted) out.push(`Pass@${hp.k} and Pass^${hp.k} omitted: ${hp.passKOmitted}`)
  }
  if (s.primary?.kind === 'comparison') {
    for (const c of s.primary.contrasts) {
      out.push(
        `${armLabel(c.from, c.from)} vs ${armLabel(c.to, c.to)}${c.harness ? ` on ${harnessName(c.harness).label}` : ''}: ${contrastMeasureLabel(c.measure)} ${c.delta.text}${c.interval ? ` (95% CI ${c.interval.text})` : ''}${c.taskDelta ? `, task average ${c.taskDelta.text}` : ''}${c.brokenTasks?.length ? `, 0%-pass tasks: ${c.brokenTasks.join(', ')}` : ''}, ${verdictLabel(c.verdict).toLowerCase()}`,
      )
    }
  }
  return out
}

function casesOf(s: EvalSection): CaseRow[] {
  const p = s.primary
  const tasks = p && p.kind !== 'regression' ? p.tasks : undefined
  if (!tasks || tasks.length < 2) return []
  return tasks.map((t) => ({
    label: t.label,
    cells: [
      ...Object.entries(t.cells).map(([column, cell]) => ({
        column: column === '-' ? 'baseline' : column,
        rate: cell.rate.n > 0 ? rate(cell.rate) : null,
      })),
      ...(t.total
        ? [{ column: 'total', rate: t.total.rate.n > 0 ? rate(t.total.rate) : null }]
        : []),
    ],
  }))
}

function checksOf(s: EvalSection): CheckRow[] {
  const p = s.primary
  const rows = p?.kind === 'task' ? p.assertions : p?.kind === 'comparison' ? p.assertionsByArm : []
  return rows.map((r) => ({
    label: r.label,
    matcher: r.matcher,
    at: r.at,
    failed: r.total.status === 'fail' || r.total.status === 'mixed' || r.total.status === 'error',
    cells: Object.entries(r.cells).map(([column, cell]) => ({
      column: column === '-' ? 'baseline' : harnessName(column).label,
      text: cell.text,
    })),
    total: r.total.text,
  }))
}

function questionsOf(s: EvalSection, label: (id: string) => string): Question[] {
  const out: Question[] = []
  for (const c of s.choices) {
    const n = c.options.reduce((sum, o) => sum + o.count, 0) + c.noPick
    out.push({
      kind: 'choices',
      question: c.question,
      options: c.options.map((o) => ({ label: o.label, count: count(o.count, n) })),
      noPick: c.noPick ? `${c.noPick} without a pick` : null,
    })
  }
  for (const p of s.judgments?.pairwise ?? []) {
    out.push({
      kind: 'pairwise',
      question: p.question,
      a: armLabel(p.a, p.a),
      b: armLabel(p.b, p.b),
      aWins: count(p.aWins, p.pairs),
      bWins: count(p.bWins, p.pairs),
      ties: figure(p.ties, plural(p.ties, 'tie')),
    })
  }
  for (const q of s.qualitative) {
    out.push({
      kind: 'answers',
      question: q.question,
      answered: count(q.answered.k, q.answered.n),
      entries: q.entries.map((e) => ({
        text: e.text,
        harness: label(e.harness),
        cite: cite(e.attempt),
      })),
    })
  }
  return out
}

function presentEval(
  s: EvalSection,
  all: readonly AttemptIndexRow[],
  label: (id: string) => string,
): EvalPresentation {
  const attempts = all.filter((a) => a.evalId === s.id)
  const state = s.state ?? (attempts.length ? 'ran' : 'not-run')
  const cmp = s.primary?.kind === 'comparison' ? s.primary : null
  const defs = state === 'ran' ? armDefs(attempts, cmp) : []
  const graded = !['choice', 'text', 'judge', 'measure'].includes(s.headline.primary.kind)
  const arms = defs.map((d) =>
    armOf(
      d,
      attempts,
      cmp?.summary.find((r) => r.arm === d.label || r.arm === d.id || r.arm === d.env),
      graded,
    ),
  )
  const envLabel = new Map(defs.map((d) => [d.env, d.label]))
  const verdict = verdictOf(s, state, attempts)
  const { metric, foot } = metricOf(s, state, attempts, arms, label)
  const name = s.group?.length ? [...s.group, s.headline.task].join(' › ') : s.name
  const harnesses = [...new Set(counted(attempts).map((a) => a.harness))]
  const effort =
    defs.length > 1
      ? defs.map((d) =>
          effortOf(
            d.label,
            attempts.filter((a) => (a.arm ?? '') === d.env),
            graded,
          ),
        )
      : harnesses.length > 1
        ? harnesses.map((h) =>
            effortOf(
              label(h),
              attempts.filter((a) => a.harness === h),
              graded,
            ),
          )
        : counted(attempts).length
          ? [effortOf('all attempts', attempts, graded)]
          : []
  const prior = s.primary?.kind === 'regression' ? s.primary : null
  return {
    id: s.id,
    anchor: s.anchor,
    name,
    file: s.file,
    shapes: s.shapes.map((x) => SHAPE_TEXT[x]),
    design: s.design,
    state,
    verdict,
    verdictText: VERDICT_TEXT[verdict],
    headline: { task: name, metric, foot, left: state === 'ran' ? leftOut(attempts) : null },
    arms,
    attempts: attempts.map(
      (a): AttemptRow => ({
        id: a.id,
        key: a.key,
        href: a.href,
        harness: label(a.harness),
        arm:
          a.arm === null || arms.length < 2
            ? null
            : (envLabel.get(a.arm) ?? armLabel(a.arm, a.arm)),
        case: a.case,
        outcome: outcomeOf(a),
        outcomeText: OUTCOME_TEXT[outcomeOf(a)],
        note:
          a.outcome === 'pass'
            ? null
            : (a.error?.message ?? a.failed?.[0]?.message ?? a.turnError ?? null),
        tokens: a.tokens.value === null ? figure(null, NOT_REPORTED) : a.tokens,
        agentTime: a.agentMs,
        cost: a.cost ? figure(a.cost.usd, a.cost.text) : figure(null, NOT_REPORTED),
      }),
    ),
    cases: casesOf(s),
    checks: checksOf(s),
    failures: (s.failures?.clusters ?? []).map((f) => ({
      kind: f.cause ?? f.kind,
      kindText: FAILURE_TEXT[f.cause ?? f.kind],
      label: f.label,
      message: f.message ? withoutLabel(f.message, f.label) : null,
      detail: f.detail ?? null,
      at: f.at,
      count: count(f.count.k, f.count.n),
      where: whereOf(f.attempts, attempts, defs, label),
      attempts: f.attempts.map(cite),
    })),
    effort,
    questions: questionsOf(s, label),
    judgments: (s.judgments?.scores ?? []).map((j) => ({
      label: j.label,
      question: j.question,
      threshold: j.threshold === null ? 'diagnostic' : judgeScoreText(j.threshold),
      median: j.spread.median,
      atOrAbove: j.atOrAbove ? count(j.atOrAbove.k, j.atOrAbove.n) : null,
    })),
    discovery: s.discovery.map((d) => ({
      what: d.what,
      found: count(d.found.k, d.found.n),
      rows: d.rows.map((r) => ({
        label: r.keys.map((k) => label(k)).join(' / '),
        found: count(r.found.k, r.found.n),
      })),
    })),
    captures: (s.captures?.rows ?? []).flatMap((r) =>
      r.shots.map((shot) => ({
        harness: label(r.harness),
        arm: r.arm,
        case: r.case,
        name: shot.name,
        href: shot.href,
        attempt: cite(shot.attempt),
        status: `HTTP ${shot.status ?? 'n/a'}, ${shot.pageErrors === null ? 'n/a' : plural(shot.pageErrors, 'page error')}`,
      })),
    ),
    regression: prior
      ? {
          prior: [
            prior.prior.startedAt.slice(0, 10),
            prior.prior.gitSha?.slice(0, 7) ?? null,
            prior.prior.branch,
          ]
            .filter(Boolean)
            .join(', '),
          priorRunId: prior.prior.runId,
          priorAuthor: prior.prior.author,
          whatChanged: prior.whatChanged,
          rows: prior.rows.map((r) => ({
            signal: r.signal,
            kind: r.kind,
            harness: r.harness === null ? null : label(r.harness),
            prior: changeSideText(r, 'prior'),
            current: changeSideText(r, 'current'),
            delta: r.delta?.text ?? 'n/a',
            status: COMPARE_STATUS_LABEL[r.status].toLowerCase(),
          })),
          unchanged: figure(prior.unchanged.length, `${prior.unchanged.length} unchanged`),
        }
      : null,
    next: (s.next ?? []).map((n) => ({ text: n.text, at: n.at })),
    remarks: [
      ...(saturated(arms) ? [SATURATED] : []),
      ...(s.failures?.remarks ?? []).map((r) => `(${r.severity}) ${r.line ?? remarkLine(r)}`),
      ...(s.notes ?? []).map((r) => `(note) ${r}`),
      ...(s.observed ?? []).map((o) => `(observed) ${o}`),
    ],
    stats: statsOf(s, metric, arms),
  }
}

function harnessesOf(report: RunReport): HarnessRow[] {
  const ids = [
    ...new Set([...report.attempts.map((a) => a.harness), ...report.roster.map((r) => r.harness)]),
  ]
  return ids.map((id) => {
    const roster = report.roster.find((r) => r.harness === id)
    const { name, model, label } = harnessName(id, roster?.model ?? null)
    const attempts = report.attempts.filter((a) => a.harness === id).length
    return {
      id,
      name,
      model,
      label,
      servedModels: roster?.servedModels ?? [],
      gateway: roster?.gateway ?? null,
      attempts: figure(attempts, plural(attempts, 'attempt')),
    }
  })
}

/** The presentation of a run report: every surface renders this and nothing else. */
export function present(report: RunReport): RunPresentation {
  const h = report.header
  const harnesses = harnessesOf(report)
  const labelOf = new Map(harnesses.map((x) => [x.id, x.label]))
  const label = (id: string) => labelOf.get(id) ?? harnessName(id).label
  const evals = report.evals.map((s) => presentEval(s, report.attempts, label))
  const evalName = new Map(evals.map((e) => [e.id, e.name]))
  const armOf = new Map(evals.flatMap((e) => e.attempts.map((a) => [a.key, a.arm] as const)))
  const canceled = report.attempts.filter((a) => a.outcome === 'canceled').length
  const infra = h.tally.infraError
  const verdicts = (v: Verdict) => evals.filter((e) => e.verdict === v).length
  const tally = {
    pass: verdicts('pass'),
    fail: verdicts('fail'),
    infraError: verdicts('infra-error'),
    canceled: verdicts('canceled'),
    skipped: verdicts('skipped'),
    todo: verdicts('todo'),
    notRun: verdicts('not-run'),
    ungated: verdicts('ungated'),
  }
  const runErrors = h.errors?.length ?? 0
  const tallyText = [
    tally.fail ? `${tally.fail} fail` : null,
    tally.pass ? `${tally.pass} pass` : null,
    tally.ungated ? `${tally.ungated} not gated` : null,
    tally.infraError ? plural(tally.infraError, 'infra error') : null,
    tally.canceled ? `${tally.canceled} canceled` : null,
    tally.skipped ? `${tally.skipped} skipped` : null,
    tally.todo ? `${tally.todo} todo` : null,
    tally.notRun ? `${tally.notRun} not run` : null,
    runErrors ? plural(runErrors, 'run error') : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const git = h.git
    ? {
        repo: h.git.repo,
        branch: h.git.branch,
        sha: h.git.sha,
        dirty: h.git.dirty,
        text: `${h.git.repo ? `${h.git.repo}@` : ''}${h.git.sha.slice(0, 7)}${h.git.dirty ? ' (dirty)' : ''}`,
      }
    : null
  const costNote = (basis: string, unpriced: number) => {
    const notes = [
      basis === 'estimated' ? 'est.' : basis === 'mixed' ? 'mixed' : null,
      unpriced ? `${unpriced} unpriced` : null,
    ].filter(Boolean)
    return notes.length ? ` (${notes.join(', ')})` : ''
  }
  const costTotal = h.cost?.total ?? h.cost?.agent ?? h.cost?.judge ?? null
  const cost =
    h.cost && costTotal
      ? figure(
          costTotal.value,
          `${
            [
              h.cost.agent ? `agent ${h.cost.agent.text}` : null,
              h.cost.judge ? `judge ${h.cost.judge.text}` : null,
            ]
              .filter(Boolean)
              .join(', ') || costTotal.text
          }${costNote(h.cost.basis, h.cost.unpriced ?? 0)}`,
        )
      : null
  const p = report.provenance
  return {
    presentationVersion: 1,
    header: {
      title: h.title,
      runId: report.runId,
      status: h.status,
      stopped:
        h.status === 'complete'
          ? null
          : `stopped early (${h.status === 'budget' ? 'budget reached' : 'interrupted'})`,
      startedAt: h.startedAt,
      date: h.startedAt.slice(0, 10),
      author: h.author,
      reeval: h.reeval,
      profile: h.profile,
      runs:
        h.runsPerCell === null
          ? 'varying runs per cell'
          : `${plural(h.runsPerCell, 'run')} per cell`,
      git,
      wall: h.wall,
      tokens: h.tokens?.total ?? tokensFigure(null),
      cost: cost ?? figure(null, NOT_REPORTED),
      counted: count(h.tally.passed, h.tally.counted - canceled),
      infraError: infra,
      canceled,
      attempts: [
        `${h.tally.passed} of ${plural(h.tally.counted - canceled, 'counted attempt')} passed`,
        infra ? plural(infra, 'infra error') : null,
        canceled ? `${canceled} canceled` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      servedBy: (h.servedBy ?? []).map((u) => `${label(u.harness)} ${u.text}`),
    },
    tally: { ...tally, text: tallyText || 'no evals' },
    caveats: [
      ...(h.errors ?? []).map((message) => ({
        severity: 'error' as const,
        text: `Run error outside any attempt: ${message}`,
        evalId: null,
        cites: [],
      })),
      ...report.integrity.map((i) => ({
        severity: i.severity,
        text:
          i.evalId && report.evals.length > 1
            ? `${evalName.get(i.evalId) ?? i.evalId}: ${i.text}`
            : i.text,
        evalId: i.evalId,
        cites: i.cites.map(cite),
      })),
    ],
    harnesses,
    evals,
    actions: report.actions.map((a) => ({ text: a.text, cites: a.cites.map(cite) })),
    provenance: {
      rows: [
        ...p.rows,
        { field: 'Artifacts', value: p.artifacts },
        ...(p.context.count ? [{ field: 'Context', value: plural(p.context.count, 'file') }] : []),
      ],
      warnings: p.warnings,
    },
    attemptIndex: report.attempts.map((a) => ({
      id: a.id,
      anchor: attemptAnchorId(a.key),
      eval: evalName.get(a.evalId) ?? a.evalId,
      harness: label(a.harness),
      arm: armOf.get(a.key) ?? null,
      case: a.case,
      outcomeText: `${OUTCOME_TEXT[outcomeOf(a)]}${a.reclassified ? ' (reclassified)' : ''}`,
      tokens: a.tokens.value === null ? figure(null, NOT_REPORTED) : a.tokens,
      agentTime: a.agentMs,
      toolCalls: a.toolCalls,
      diff: a.diff?.text ?? 'not recorded',
      links: [
        ...(a.links.transcript ? [{ name: 'transcript', href: a.links.transcript }] : []),
        ...(a.links.diff ? [{ name: 'diff', href: a.links.diff }] : []),
        ...a.links.captures,
        ...a.links.questions.map((href, i) => ({ name: `q${i + 1}`, href })),
      ],
    })),
  }
}
