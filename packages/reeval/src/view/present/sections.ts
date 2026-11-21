// The one order every renderer walks a presentation in, and the strings each section must print.
// Each renderer takes the list from `sectionsOf`, so the terminal, summary.md and the studio show
// the same sections in the same order; the parity tests hold every render to `sectionTexts`.
import type { EvalPresentation, Metric, RunPresentation } from './schema.ts'

/**
 * What a surface prints: `full` is everything but the statistics (summary.md and the studio),
 * `brief` the terminal's subset, and `verbose` the terminal's subset with the statistics (`-v`).
 */
export type Detail = 'brief' | 'full' | 'verbose'

export type SectionKind =
  | 'run'
  | 'caveats'
  | 'harnesses'
  | 'eval'
  | 'arms'
  | 'cases'
  | 'attempts'
  | 'checks'
  | 'failures'
  | 'effort'
  | 'questions'
  | 'judgments'
  | 'discovery'
  | 'captures'
  | 'regression'
  | 'next'
  | 'stats'
  | 'actions'
  | 'tally'
  | 'provenance'
  | 'attempt-index'

export type Section = {
  /** Unique in the presentation: `run`, `<eval anchor>`, `<eval anchor>/failures`. */
  id: string
  kind: SectionKind
  /** The least detail that prints it; `verbose` sections print under `-v` only. */
  level: 'brief' | 'full' | 'verbose'
  /** The eval an eval section belongs to; null on a run section. */
  eval: EvalPresentation | null
}

const EVAL_KINDS: Array<{
  kind: SectionKind
  level: (e: EvalPresentation) => Section['level']
  shown: (e: EvalPresentation) => boolean
}> = [
  { kind: 'eval', level: () => 'brief', shown: () => true },
  { kind: 'arms', level: () => 'brief', shown: (e) => e.arms.length > 1 },
  // A failed eval's cases say which one failed it, so the terminal prints them too.
  {
    kind: 'cases',
    level: (e) => (e.verdict === 'fail' ? 'brief' : 'full'),
    shown: (e) => e.cases.length > 0,
  },
  { kind: 'attempts', level: () => 'full', shown: (e) => e.attempts.length > 0 },
  { kind: 'checks', level: () => 'full', shown: (e) => e.checks.length > 0 },
  { kind: 'failures', level: () => 'brief', shown: (e) => e.failures.length > 0 },
  { kind: 'effort', level: () => 'full', shown: (e) => e.effort.length > 0 },
  { kind: 'questions', level: () => 'brief', shown: (e) => e.questions.length > 0 },
  { kind: 'judgments', level: () => 'full', shown: (e) => e.judgments.length > 0 },
  { kind: 'discovery', level: () => 'full', shown: (e) => e.discovery.length > 0 },
  { kind: 'captures', level: () => 'full', shown: (e) => e.captures.length > 0 },
  { kind: 'regression', level: () => 'brief', shown: (e) => e.regression !== null },
  { kind: 'next', level: () => 'brief', shown: (e) => e.next.length + e.remarks.length > 0 },
  { kind: 'stats', level: () => 'verbose', shown: (e) => e.stats.length > 0 },
]

const printed = (level: Section['level'], detail: Detail) =>
  detail === 'full' ? level !== 'verbose' : level === 'brief' || detail === level

/** The sections `detail` prints, in the order every surface prints them. */
export function sectionsOf(p: RunPresentation, detail: Detail = 'full'): Section[] {
  const all: Section[] = [{ id: 'run', kind: 'run', level: 'brief', eval: null }]
  if (p.caveats.length) {
    const level = p.caveats.some((c) => c.severity === 'error') ? 'brief' : 'full'
    all.push({ id: 'caveats', kind: 'caveats', level, eval: null })
  }
  if (p.harnesses.length)
    all.push({ id: 'harnesses', kind: 'harnesses', level: 'full', eval: null })
  for (const e of p.evals) {
    for (const k of EVAL_KINDS) {
      if (!k.shown(e)) continue
      const id = k.kind === 'eval' ? e.anchor : `${e.anchor}/${k.kind}`
      all.push({ id, kind: k.kind, level: k.level(e), eval: e })
    }
  }
  if (p.actions.length) all.push({ id: 'actions', kind: 'actions', level: 'brief', eval: null })
  all.push({ id: 'tally', kind: 'tally', level: 'brief', eval: null })
  all.push({ id: 'provenance', kind: 'provenance', level: 'full', eval: null })
  if (p.attemptIndex.length) {
    all.push({ id: 'attempt-index', kind: 'attempt-index', level: 'full', eval: null })
  }
  return all.filter((s) => printed(s.level, detail))
}

/** The headline's big text: `75% passed`, `0% vs 100%`, `median 0.80 on 0 to 1`. */
export function metricText(m: Metric): string {
  switch (m.kind) {
    case 'rate':
      return `${m.value.text} ${m.label}`
    case 'compare':
      return `${m.baseline.label} ${m.baseline.rate.text} vs ${m.variant.label} ${m.variant.rate.text}`
    case 'counts':
      return m.options.map((o) => `${o.label} ${o.count.k}`).join(', ')
    case 'median':
      return `${m.label}: median ${m.value.text}`
    case 'score':
      return `${m.label}: median ${m.value.text} on ${m.scale}`
    case 'quote':
      return m.question
    case 'changes':
      return `${m.worse.text} worse, ${m.fixed.text} fixed`
    case 'none':
      return m.text
  }
}

function metricTexts(m: Metric): string[] {
  switch (m.kind) {
    case 'rate':
      return [m.value.text, m.label, m.rate.of]
    case 'compare':
      return [
        m.baseline.label,
        m.baseline.rate.text,
        m.variant.label,
        m.variant.rate.text,
        ...(m.effectText ? [m.effectText] : []),
      ]
    case 'counts':
      return m.options.map((o) => o.label)
    case 'median':
    case 'score':
      return [m.value.text]
    case 'quote':
      return []
    case 'changes':
      return [m.worse.text, m.fixed.text]
    case 'none':
      return []
  }
}

/**
 * The strings a section's render must hold verbatim: its figures, counts, rates, headline,
 * verdict and effect words. Free text (messages, quotes, questions) may be clipped, so it's out.
 * The breakdowns behind a chart (rates by harness, picks by group, each judge score) print from
 * `full`, so `brief` leaves them out.
 */
export function sectionTexts(p: RunPresentation, s: Section, detail: Detail = 'full'): string[] {
  const e = s.eval
  const out: string[] = []
  const rows = detail !== 'brief'
  switch (s.kind) {
    case 'run':
      out.push(p.header.title, p.header.wall.text, p.header.attempts, ...p.header.servedBy)
      break
    case 'caveats':
      break
    case 'harnesses':
      for (const h of p.harnesses) out.push(h.label, h.attempts.text)
      break
    case 'eval':
      if (!e) break
      out.push(e.name, e.verdictText, ...metricTexts(e.headline.metric))
      if (e.headline.foot) out.push(e.headline.foot)
      if (e.headline.left) out.push(e.headline.left)
      break
    case 'arms':
      for (const a of e?.arms ?? []) {
        out.push(a.label, a.rate.text, a.rate.of)
        if (a.effectText) out.push(a.effectText)
        if (a.left) out.push(a.left)
      }
      if (rows) {
        for (const h of e?.byHarness ?? []) {
          out.push(h.label)
          for (const cell of h.cells) if (cell.rate) out.push(cell.rate.text, cell.rate.of)
        }
      }
      break
    case 'cases':
      for (const c of e?.cases ?? []) {
        out.push(c.label)
        for (const cell of c.cells) if (cell.rate) out.push(cell.rate.text, cell.rate.of)
      }
      break
    case 'attempts':
      for (const a of e?.attempts ?? []) {
        out.push(a.id, a.outcomeText, a.tokens.text, a.agentTime.text, a.cost.text)
      }
      break
    case 'checks':
      for (const c of e?.checks ?? []) out.push(c.total, ...c.cells.map((x) => x.text))
      break
    case 'failures':
      for (const f of e?.failures ?? [])
        out.push(f.kindText, f.count.text, ...(f.where ? [f.where] : []))
      break
    case 'effort':
      for (const r of e?.effort ?? []) {
        out.push(
          r.label,
          r.tokens.text,
          r.toolCalls.text,
          r.agentTime.text,
          r.cost.text,
          r.costPerPass.text,
        )
      }
      break
    case 'questions':
      for (const q of e?.questions ?? []) {
        if (q.kind === 'choices') {
          for (const o of q.options) out.push(o.count.text)
          if (rows) {
            for (const r of q.rows) out.push(r.label, ...r.picks.map((x) => x.count.text))
            for (const x of q.passByPick) out.push(x.rate.text, x.rate.of)
          }
        }
        if (q.kind === 'pairwise') out.push(...q.sides.map((s) => s.wins.text), q.ties.text)
        if (q.kind === 'answers') out.push(q.answered.text)
        if (q.kind === 'unanswered') out.push(q.text)
      }
      break
    case 'judgments':
      for (const j of e?.judgments ?? []) {
        out.push(j.threshold, j.median.text)
        if (j.atOrAbove) out.push(j.atOrAbove.text)
        if (rows) for (const x of j.scores) out.push(x.attempt.id, x.score.text)
      }
      break
    case 'discovery':
      for (const d of e?.discovery ?? []) {
        out.push(d.found.text, ...d.rows.map((r) => r.found.text))
      }
      break
    case 'captures':
      for (const c of e?.captures ?? []) out.push(c.status)
      break
    case 'regression':
      for (const r of e?.regression?.rows ?? []) out.push(r.prior, r.current, r.delta, r.status)
      break
    case 'next':
      for (const n of e?.next ?? []) out.push(n.text)
      break
    case 'stats':
      out.push(...(e?.stats ?? []))
      break
    case 'actions':
      break
    case 'tally':
      out.push(p.tally.text)
      break
    case 'provenance':
      for (const r of p.provenance.rows) out.push(r.field)
      break
    case 'attempt-index':
      for (const a of p.attemptIndex) out.push(a.id, a.outcomeText, a.tokens.text, a.agentTime.text)
      break
  }
  return out.filter((t) => t.length > 0)
}
