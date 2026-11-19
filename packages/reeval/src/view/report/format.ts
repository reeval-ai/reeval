import { median, quantile, wilson } from '../../stats.ts'
import { formatDuration } from '../../text.ts'
import { formatTokens } from '../../usage.ts'
import { formatUsd } from '../cost.ts'
import { formatCount, formatSeconds } from '../effort.ts'
import type { Remark } from '../remarks.ts'
import { measurePhrase, PASS_RATE_OUTCOME_LABEL } from './labels.ts'
import type {
  ChangeRow,
  Count,
  Delta,
  Figure,
  HeadlineResult,
  Interval,
  MeasureKey,
  Proportion,
  Rate,
  Spread,
} from './types.ts'

/** Tokens as people read them; `M` with one decimal from 10M. */
export function tokensText(n: number): string {
  if (n >= 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  return formatTokens(n)
}

export function figure(value: number | null, text: string): Figure {
  return { value, text }
}

export function tokensFigure(value: number | null | undefined): Figure {
  if (value === null || value === undefined) return figure(null, 'not reported')
  return figure(value, tokensText(value))
}

export function durationFigure(ms: number | null | undefined): Figure {
  if (ms === null || ms === undefined) return figure(null, 'not reported')
  return figure(ms, formatDuration(ms))
}

export function usdFigure(usd: number | null | undefined): Figure {
  if (usd === null || usd === undefined) return figure(null, 'not reported')
  return figure(usd, formatUsd(usd))
}

export function countFigure(value: number | null | undefined, missing = 'not reported'): Figure {
  if (value === null || value === undefined) return figure(null, missing)
  return figure(value, String(value))
}

/** `<k> of <n>`. */
export function countOf(k: number, n: number): Count {
  return { k, n, text: `${k} of ${n}` }
}

/**
 * Pass-rate points: signed integer `pts`. Zero is `±0 pts`.
 * Ratio scales use `pctDelta` instead.
 */
export function ptsDelta(points: number | null): Delta {
  if (points === null || !Number.isFinite(points)) {
    return { value: null, unit: 'pts', text: 'n/a' }
  }
  const pct = Math.round(points * 100)
  if (pct === 0) return { value: 0, unit: 'pts', text: '±0 pts' }
  return { value: points, unit: 'pts', text: `${pct > 0 ? '+' : ''}${pct} pts` }
}

/**
 * Signed integer `%` of a positive ratio scale. Absolute value below 2 is `±0%`.
 * Baseline 0 is `n/a`.
 */
export function pctDelta(variant: number | null, baseline: number | null): Delta {
  if (
    variant === null ||
    baseline === null ||
    !Number.isFinite(variant) ||
    !Number.isFinite(baseline) ||
    baseline === 0
  ) {
    return { value: null, unit: 'pct', text: 'n/a' }
  }
  const raw = ((variant - baseline) / baseline) * 100
  const rounded = Math.round(raw)
  if (Math.abs(rounded) < 2) return { value: 0, unit: 'pct', text: '±0%' }
  return { value: raw / 100, unit: 'pct', text: `${rounded > 0 ? '+' : ''}${rounded}%` }
}

/** `95% CI <lo> pts to <hi> pts` as the interval's `text` when `unit` is points. */
export function ptsInterval(lo: number, hi: number): Interval {
  const fmt = (x: number) => {
    const n = Math.round(x * 100)
    return `${n > 0 ? '+' : ''}${n} pts`
  }
  return { lo, hi, text: `${fmt(lo)} to ${fmt(hi)}` }
}

/** Wilson rate: integer percent text, interval null at n = 0. */
export function rateOf(k: number, n: number): Rate {
  if (n <= 0) {
    return { k, n, rate: null, text: 'n/a', interval: null }
  }
  const rate = k / n
  const { low, high } = wilson(k, n)
  return {
    k,
    n,
    rate,
    text: `${Math.round(rate * 100)}%`,
    interval: ptsInterval(low, high),
  }
}

export function spreadOf(values: readonly number[], format: (n: number) => string): Spread | null {
  if (values.length === 0) return null
  const med = median(values)
  const q1 = quantile(values, 0.25)
  const q3 = quantile(values, 0.75)
  if (med === null || q1 === null || q3 === null) return null
  return {
    n: values.length,
    median: figure(med, format(med)),
    q1: figure(q1, format(q1)),
    q3: figure(q3, format(q3)),
  }
}

/** Median text plus optional `%` delta in parentheses (`461k (-42%)`). */
export function medianWithDelta(medianText: string, delta: Delta | null): string {
  if (!delta || delta.text === 'n/a') return medianText
  return `${medianText} (${delta.text})`
}

/** Judge score on its own scale: two decimals, never `%`. */
export function judgeScoreText(score: number): string {
  return score.toFixed(2)
}

/** Diff line counts excluding lockfiles: `+485 / -153`. */
export function diffLinesText(added: number, removed: number): string {
  return `+${added} / -${removed}`
}

/** `{ k, n }` of a `Count` or `Rate`. */
export const proportion = ({ k, n }: Proportion): Proportion => ({ k, n })

/** `12 of 12`. */
export const proportionText = ({ k, n }: Proportion): string => `${k} of ${n}`

/** `75%`, or `n/a` at n = 0, as `rateOf` prints it. */
export const percentText = ({ k, n }: Proportion): string =>
  n <= 0 ? 'n/a' : `${Math.round((k / n) * 100)}%`

/** How each measure's values print in a table cell. */
export const MEASURE_TEXT: Record<MeasureKey, (n: number) => string> = {
  tokens: tokensText,
  toolCalls: formatCount,
  turns: formatCount,
  costUsd: (n) => formatUsd(n),
  agentMs: formatSeconds,
  filesChanged: formatCount,
  linesAdded: formatCount,
  linesRemoved: formatCount,
}

const UNIT_TEXT: Record<
  Extract<HeadlineResult, { kind: 'measure' }>['unit'],
  (n: number) => string
> = {
  tokens: tokensText,
  ms: formatSeconds,
  usd: (n) => formatUsd(n),
  count: formatCount,
  lines: formatCount,
  files: formatCount,
}

/** A change row's side: its counts as `k of n` when it has them, else the comparison's text. */
export function changeSideText(row: ChangeRow, side: 'prior' | 'current'): string {
  const counts = side === 'prior' ? row.priorPassed : row.currentPassed
  return counts ? proportionText(counts) : row[side]
}

/** An eval's headline in one line, the rollup's `Primary result` cell. */
export function headlineResultText(r: HeadlineResult): string {
  switch (r.kind) {
    case 'pass-rate':
      return `${percentText(r.passed)} ${PASS_RATE_OUTCOME_LABEL[r.outcome]}`
    case 'lift':
      return `${r.variant} vs ${r.baseline}: ${ptsDelta(r.points).text} pass rate (${percentText(r.variantPassed)} vs ${percentText(r.baselinePassed)})`
    case 'tied-ceiling': {
      const text = MEASURE_TEXT[r.measure]
      const delta = pctDelta(r.variantMedian, r.baselineMedian).text
      return `${r.variant} vs ${r.baseline}: tied at ${percentText(r.passed)} pass rate, median ${measurePhrase(r.measure)} ${delta} (${text(r.variantMedian)} vs ${text(r.baselineMedian)})`
    }
    case 'choice':
      return `${r.question}: ${r.options.map((o) => `${o.label} ${o.count}`).join(', ')}`
    case 'measure':
      return `Median ${r.label}: ${r.median === null ? 'not reported' : UNIT_TEXT[r.unit](r.median)}`
    case 'judge':
      return `${r.label}: median ${r.median === null ? 'n/a' : judgeScoreText(r.median)} on ${r.scale[0]} to ${r.scale[1]}`
    case 'text':
      return r.question
    case 'regression': {
      const parts = [
        r.worse ? `${r.worse} worse` : null,
        r.fixed ? `${r.fixed} fixed` : null,
      ].filter(Boolean)
      const counts = parts.length ? parts.join(', ') : 'no gated flips'
      if (!r.lead) return counts
      return `${counts}: ${r.lead.signal}, ${changeSideText(r.lead, 'prior')} to ${changeSideText(r.lead, 'current')}`
    }
  }
}

/** `source:file#L12` as `file:12`, as the CLI's Worth knowing line prints it. */
const remarkLocation = (at: string) => at.replace(/^source:/, '').replace(/#L(\d+)$/, ':$1')

/** A remark with its fix as one plain line. */
export function remarkLine(r: { text: string; fix?: Remark['fix'] | null }): string {
  if (!r.fix?.at) return r.text
  return r.fix.edit
    ? `${r.text} Fix at ${remarkLocation(r.fix.at)}: ${r.fix.edit}.`
    : `${r.text} At ${remarkLocation(r.fix.at)}.`
}
