// `reeval/renderer/ascii`: a run's presentation as terminal text, the one renderer behind the
// results `reeval run` ends with and `reeval show`. It prints the sections `sectionsOf` lists for
// its detail, in that order, and formats nothing: each figure's text comes from `present()`.
import {
  type EvalPresentation,
  metricText,
  type RunPresentation,
  type Section,
  sectionsOf,
  type Verdict,
} from '../view/present/index.ts'

type Paint = (text: string) => string

/** How the terminal colors text; plain when unset. */
export type RunReportTextStyle = {
  verdict?: (verdict: Verdict, text: string) => string
  dim?: Paint
  bold?: Paint
}

export type RunReportTextOptions = {
  /** `brief` (the default), or `verbose` for `-v`'s statistics too; `full` prints every section. */
  detail?: 'brief' | 'full' | 'verbose'
  /** Columns to clip free text to; unclipped when unset. */
  width?: number
  style?: RunReportTextStyle
  /** Called with each section as it's printed, in order. */
  onSection?: (section: Section) => void
}

const VERDICT_WIDTH = 13
const INDENT = ' '.repeat(VERDICT_WIDTH + 2)

function clip(s: string, max: number): string {
  const t = s.replace(/\s*\n\s*/g, ' ').trim()
  return t.length > max ? `${t.slice(0, Math.max(1, max - 1))}…` : t
}

function columns(rows: string[][]): string[] {
  const widths: number[] = []
  for (const r of rows) {
    for (const [i, c] of r.entries()) widths[i] = Math.max(widths[i] ?? 0, c.length)
  }
  return rows.map((r) =>
    r
      .map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i] ?? 0)))
      .join('  ')
      .trimEnd(),
  )
}

function sectionLines(
  p: RunPresentation,
  s: Section,
  width: number,
  style: Required<RunReportTextStyle>,
  verbose: boolean,
): string[] {
  const e = s.eval as EvalPresentation
  const free = Math.max(20, width - INDENT.length)
  switch (s.kind) {
    case 'run': {
      const h = p.header
      const facts = [
        h.attempts,
        `${h.wall.text} wall time`,
        `tokens ${h.tokens.text}`,
        `cost ${h.cost.text}`,
        ...(h.git ? [h.git.text] : []),
      ]
      return [
        style.bold(h.title),
        ...(h.stopped ? [`The run ${h.stopped}.`] : []),
        style.dim(`${facts.join(' · ')}`),
        ...h.servedBy.map((t) => style.dim(t)),
      ]
    }
    case 'caveats':
      return p.caveats.map((c) => {
        const tag = c.severity === 'error' ? 'Error' : 'Warning'
        return `${tag}: ${clip(c.text, width - tag.length - 2)}`
      })
    case 'harnesses':
      return [
        'Coding harnesses',
        ...columns(p.harnesses.map((h) => [h.label, h.attempts.text])).map((l) => `  ${l}`),
      ]
    case 'eval': {
      const m = e.headline.metric
      const effect = m.kind === 'compare' && m.effectText ? `: ${m.effectText}` : ''
      const foot = [
        m.kind === 'none' ? null : `${metricText(m)}${effect}`,
        e.headline.foot || null,
        e.headline.left ? `left out: ${e.headline.left}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      return [
        `${style.verdict(e.verdict, e.verdictText.toUpperCase().padEnd(VERDICT_WIDTH))}  ${style.bold(e.name)}`,
        ...(foot ? [`${INDENT}${foot}`] : []),
      ]
    }
    case 'arms':
      return columns(
        e.arms.map((a) => [
          a.label,
          a.rate.text,
          a.rate.of,
          a.effectText ?? a.role,
          a.left ? `left out: ${a.left}` : '',
        ]),
      ).map((l) => `${INDENT}${l}`)
    case 'cases': {
      // With one column, its total says it again.
      const shown = (cells: (typeof e.cases)[number]['cells']) =>
        cells.length === 2 ? cells.slice(0, 1) : cells
      const one = e.cases.every((c) => c.cells.length === 2)
      if (one)
        return columns(
          e.cases.map((c) => {
            const x = shown(c.cells)[0]
            return [c.label, x?.rate?.text ?? 'n/a', x?.rate?.of ?? '']
          }),
        ).map((l) => `${INDENT}${l}`)
      return e.cases.map(
        (c) =>
          `${INDENT}${c.label}: ${c.cells.map((x) => `${x.column} ${x.rate ? `${x.rate.text} (${x.rate.of})` : 'n/a'}`).join(', ')}`,
      )
    }
    case 'attempts':
      return columns(
        e.attempts.map((a) => [a.id, a.outcomeText, a.tokens.text, a.agentTime.text, a.cost.text]),
      ).map((l) => `${INDENT}${l}`)
    case 'checks':
      return e.checks.map(
        (c) =>
          `${INDENT}${clip(c.label, 40)}: ${c.cells.map((x) => x.text).join(', ')} (${c.total})`,
      )
    case 'failures':
      return e.failures.flatMap((f) => {
        const head = `${f.kindText}, ${f.count.text}${f.where ? `, ${f.where}` : ''}`
        return [
          `${INDENT}${head}: ${clip(f.label, free - head.length - 2)}`,
          ...(f.message ? [`${INDENT}  ${style.dim(clip(f.message, free - 2))}`] : []),
          ...(verbose && f.detail
            ? f.detail.split('\n').map((l) => `${INDENT}    ${style.dim(l)}`)
            : []),
          ...(f.at ? [`${INDENT}  ${style.dim(`at ${f.at}`)}`] : []),
        ]
      })
    case 'effort':
      return columns(
        e.effort.map((r) => [
          r.label,
          r.tokens.text,
          r.toolCalls.text,
          r.agentTime.text,
          r.cost.text,
          r.costPerPass.text,
        ]),
      ).map((l) => `${INDENT}${l}`)
    case 'questions':
      return e.questions.flatMap((q) => [
        `${INDENT}${clip(q.kind === 'pairwise' && q.cut ? `${q.question} (${q.cut})` : q.question, free)}`,
        q.kind === 'choices'
          ? `${INDENT}  ${q.options.map((o) => `${o.label} ${o.count.text}`).join(', ')}${q.noPick ? `, ${q.noPick}` : ''}`
          : q.kind === 'pairwise'
            ? `${INDENT}  ${[...q.sides.map((s) => `${s.label} ${s.wins.text}`), q.ties.text].join(', ')}`
            : q.kind === 'unanswered'
              ? `${INDENT}  ${q.text}`
              : `${INDENT}  ${q.answered.text} answered`,
        ...(q.kind === 'answers'
          ? q.entries.slice(0, 1).map((a) => `${INDENT}  ${a.harness}  ${clip(a.text, free - 2)}`)
          : []),
      ])
    case 'judgments':
      return e.judgments.map(
        (j) =>
          `${INDENT}${j.label}: median ${j.median.text}, threshold ${j.threshold}${j.atOrAbove ? `, ${j.atOrAbove.text} at or above` : ''}`,
      )
    case 'discovery':
      return e.discovery.map(
        (d) =>
          `${INDENT}${d.what}: ${d.found.text}${d.rows.length ? ` (${d.rows.map((r) => `${r.label} ${r.found.text}`).join(', ')})` : ''}`,
      )
    case 'captures':
      return e.captures.map((c) => `${INDENT}${c.name}, ${c.attempt.id}: ${c.status}`)
    case 'regression': {
      const r = e.regression
      if (!r) return []
      return [
        `${INDENT}Since ${r.prior}, ${r.priorRunId}:`,
        ...columns(r.rows.map((x) => [x.signal, x.prior, x.current, x.delta, x.status])).map(
          (l) => `${INDENT}  ${l}`,
        ),
        `${INDENT}  ${r.unchanged.text}`,
      ]
    }
    case 'next':
      return [
        ...e.next.map((n) => `${INDENT}Next: ${n.at ? `at ${n.at}, ` : ''}${n.text}`),
        ...e.remarks.map((r) => `${INDENT}${style.dim(clip(r, free))}`),
      ]
    case 'stats':
      return e.stats.map((t) => `${INDENT}${style.dim(t)}`)
    case 'actions':
      return ['Recommended actions', ...p.actions.map((a) => `  ${clip(a.text, width - 2)}`)]
    case 'tally':
      return [`Evals: ${p.tally.text}`]
    case 'provenance':
      return columns(p.provenance.rows.map((r) => [r.field, r.value]))
    case 'attempt-index':
      return columns(
        p.attemptIndex.map((a) => [a.id, a.eval, a.harness, a.outcomeText, a.tokens.text]),
      )
  }
}

/** A run's presentation as terminal text: the brief sections by default, in every surface's order. */
export function runReportText(p: RunPresentation, options: RunReportTextOptions = {}): string {
  const plain: Paint = (t) => t
  const style: Required<RunReportTextStyle> = {
    verdict: options.style?.verdict ?? ((_, t) => t),
    dim: options.style?.dim ?? plain,
    bold: options.style?.bold ?? plain,
  }
  const width = options.width ?? Number.POSITIVE_INFINITY
  const out: string[] = []
  let prev: Section | null = null
  for (const s of sectionsOf(p, options.detail ?? 'brief')) {
    options.onSection?.(s)
    const block = sectionLines(p, s, width, style, options.detail === 'verbose')
    if (block.length === 0) continue
    if (prev && !(s.eval && prev.eval === s.eval)) out.push('')
    out.push(...block)
    prev = s
  }
  return `${out.join('\n')}\n`
}
