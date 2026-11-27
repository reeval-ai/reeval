// The result blocks every surface prints (the terminal, summary.md, `reeval show`): one line per
// eval against its target (`target.ts`), its cases under it on a miss, a compare's environments, then the
// tally. Pure and deterministic: the same SuiteResult and remarks always print the same lines.
// Scores read as percentages, environment counts `N of M` and effects words; statistics print only with
// `verbose`.

import type { Interval } from '../stats.ts'
import { targetLabel } from '../target.ts'
import { clip, plural } from '../text.ts'
import { formatTokens } from '../usage.ts'
import { formatCount, formatSeconds } from '../view/effort.ts'
import type { Measure } from '../view/measures.ts'
import { type ObservedTally, observedLine } from '../view/observations.ts'
import type { RunRemarks } from '../view/remarks.ts'
import type {
  Across,
  CaseResult,
  CellError,
  CellResult,
  CheckResult,
  Effect,
  EvalResult,
  PooledEnvironment,
  QuestionResult,
  SuiteResult,
  TrialQuestionResult,
} from '../view/suite.ts'
import { canceledOf, countedOf } from '../view/suite.ts'
import { standing, targetNumber } from '../view/target.ts'
import { type Colors, colors, type Paint } from './colors.ts'
import { remarkLines } from './remarks.ts'
import {
  caseRows,
  expands,
  failureFacts,
  location,
  MARK,
  notRunCases,
  rowPercent,
  tallyParts,
} from './target.ts'

export type Layout = {
  kind: 'results' | 'measure' | 'agents' | 'both' | 'regressions'
  /** An eval with `cases`: the kind's rows, one per case, inside one block. */
  family: boolean
}

/** The block for an eval: a pure function of its shape. */
export function layout(across: Across, isFamily: boolean, isCompare: boolean): Layout {
  if (isCompare) return { kind: 'regressions', family: false }
  const kind =
    across === 'change'
      ? 'measure'
      : across === 'harness'
        ? 'agents'
        : across === 'both'
          ? 'both'
          : 'results'
  return { kind, family: isFamily }
}

export type RenderOptions = {
  color: boolean
  /** `-v`: each variant's difference and interval under its effect word. */
  verbose: boolean
  /** Lines between the blocks and the tally, as they are: the run's time and where its results are. */
  notes?: string[]
}

/** Where a block's name starts, after its verdict word. */
export const HEAD = 17
/** The narrowest a row's label column is, so short labels line up under the name. */
const LABEL = 17
const ASSERTION_MAX = 160
const CHECK_LABEL_MAX = 48

/** A check's label on one line: an expected value can carry line breaks. */
export const checkLabel = (label: string) => clip(label.replace(/\s*\n\s*/g, ' '), CHECK_LABEL_MAX)

const EFFECT: Record<Effect, string> = {
  better: 'helped',
  worse: 'made it worse',
  same: 'same',
}

export type Text = { text: string; paint?: Paint }
/** One row: its cells line up with the other rows of its table. A `loose` row's later cells don't widen their columns. */
type Row = { indent: number; cells: Array<string | Text>; loose?: boolean }
/** A line printed as it is, under a row. */
type Free = { indent: number; free: string | Text }
export type Item = Row | Free

export const t = (text: string, paint?: Paint): Text => ({ text, paint })
const textOf = (cell: string | Text) => (typeof cell === 'string' ? cell : cell.text)
export const show = (cell: string | Text) =>
  typeof cell === 'string' ? cell : cell.paint ? cell.paint(cell.text) : cell.text

/**
 * Aligned rows: the first column is as wide as the widest label with its indent (at least
 * `LABEL`), the others as their widest cell, two spaces apart. Free lines print as they are.
 */
export function table(items: Item[], width = LABEL): string[] {
  const rows = items.filter((i): i is Row => 'cells' in i)
  const first = Math.max(
    width,
    ...rows
      .filter((r) => r.cells.length > 1)
      .map((r) => r.indent + textOf(r.cells[0] ?? '').length),
  )
  const widths: number[] = []
  for (const r of rows) {
    if (r.loose) continue
    r.cells.forEach((cell, i) => {
      if (i > 0) widths[i] = Math.max(widths[i] ?? 0, textOf(cell).length)
    })
  }
  return items.map((item) => {
    const pad = ' '.repeat(item.indent)
    if ('free' in item) return `${pad}${show(item.free)}`
    const out = item.cells.map((cell, i) => {
      const width = i === 0 ? first - item.indent : (widths[i] ?? 0)
      const fill = ' '.repeat(Math.max(0, width - textOf(cell).length))
      return i === item.cells.length - 1 ? show(cell) : `${show(cell)}${fill}`
    })
    return `${pad}${out.join('  ')}`.trimEnd()
  })
}

/**
 * `3 of 4`, with the trials that didn't count named: `2 of 3 · 1 infra error · 1 skipped`. A
 * canceled trial is recorded as a fail, but the agent didn't fail it, so it's named apart, and
 * a best-of cell names the trials its majority made unneeded: `0 of 3 · 2 not needed (best of 5)`.
 */
function cellCount(cell: CellResult): string {
  const canceled = canceledOf(cell)
  const counted = countedOf(cell)
  const notNeeded = cell.notNeeded ?? 0
  const skipped = cell.skipped - notNeeded
  const parts = [
    counted > 0 ? `${cell.passed} of ${counted}` : '',
    cell.infraError ? plural(cell.infraError, 'infra error') : '',
    canceled ? `${canceled} canceled` : '',
    skipped ? `${skipped} skipped` : '',
    notNeeded ? `${notNeeded} not needed (best of ${cell.bestOf})` : '',
  ].filter(Boolean)
  if (!parts.length) return 'not run'
  return parts.join(' · ')
}

const failing = (k: CheckResult) =>
  k.outcome.status === 'not run' || k.outcome.failed + k.outcome.errored > 0

/** A check's result in a cell: `not run`, `failed` for one try, else `1 of 4 · 2 not run`. */
export function checkCount(k: CheckResult, single: boolean): string {
  const o = k.outcome
  if (o.status === 'not run') return 'not run'
  const answered = o.passed + o.failed + o.errored
  const head =
    single && answered === 1
      ? o.failed
        ? 'failed'
        : o.errored
          ? "couldn't check"
          : 'passed'
      : `${o.passed} of ${answered}`
  const notes = [
    !single && o.errored ? `${o.errored} couldn't check` : '',
    o.notRun ? `${o.notRun} not run` : '',
  ].filter(Boolean)
  return [head, ...notes].join(' · ')
}

/** The check's first failure, less the `label: ` its row already shows. */
export function assertionOf(k: CheckResult): string {
  if (k.outcome.status !== 'ran' || !k.outcome.assertion) return ''
  const line = k.outcome.assertion.trim().split('\n')[0]?.trim() ?? ''
  return clip(
    line.startsWith(`${k.label}: `) ? line.slice(k.label.length + 2) : line,
    ASSERTION_MAX,
  )
}

/** Where the eval made the check's first failure, `evals/a.eval.ts:7`. */
export const atOf = (k: CheckResult) => (k.outcome.status === 'ran' ? (k.outcome.at ?? '') : '')

/** An error no check explains, by kind: a throw in the eval's body reads `error`. */
const ERROR_KIND: Record<CellError['kind'], string> = {
  assertion: 'error',
  judge: 'judge',
  timeout: 'timeout',
  aborted: 'canceled',
  infra: 'infra error',
  turn: 'turn error',
}

export const errorKind = (err: CellError) => ERROR_KIND[err.kind]

export const errorText = (err: CellError) =>
  `${clip(err.message, ASSERTION_MAX)}${err.trials > 1 ? ` (${plural(err.trials, 'trial')})` : ''}`

/** A baseline with no environment of its own is the baseline the variants change. */
const environmentOf = (cell: CellResult) =>
  cell.variant ?? (cell.environment === '-' ? 'baseline' : cell.environment)

/** Each cell's label: the parts that vary between them (harness, environment, sandbox). */
export function labeler(cells: CellResult[], parts: Array<'harness' | 'environment' | 'sandbox'>) {
  const vary = parts.filter((p) => {
    const of = (cell: CellResult) =>
      p === 'harness' ? cell.harness : p === 'environment' ? environmentOf(cell) : cell.sandbox
    return new Set(cells.map(of)).size > 1
  })
  const used = vary.length ? vary : parts.slice(0, 1)
  return (cell: CellResult) =>
    used
      .map((p) =>
        p === 'harness' ? cell.harness : p === 'environment' ? environmentOf(cell) : cell.sandbox,
      )
      .join(' · ')
}

const effectText = (c: Colors, effect: Effect | null): Text => {
  if (!effect) return t('')
  const paint = effect === 'better' ? c.green : effect === 'worse' ? c.red : c.dim
  return t(EFFECT[effect], paint)
}

const signedPoints = (x: number) => `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}`

/** `-v`: a variant's difference from its baseline and the interval its effect comes from. */
export function statsLine(cell: CellResult, cells: CellResult[]): string | null {
  const base = cells.find((x) => x.key === cell.vs)
  if (!base || !cell.interval) return null
  const rate = (x: CellResult) => (x.passed + x.failed ? x.passed / (x.passed + x.failed) : 0)
  return `difference ${signedPoints(rate(cell) - rate(base))} points, 95% interval ${signedPoints(cell.interval.low)}…${signedPoints(cell.interval.high)}`
}

/** The checks that failed or didn't run in some cell, a column per cell; the rest pass everywhere. */
function checkMatrix(
  c: Colors,
  cells: CellResult[],
  label: (cell: CellResult) => string,
  indent: number,
  width: number,
): string[] {
  const labels = [...new Set(cells.flatMap((x) => x.checks.map((k) => k.label)))]
  const shown = labels.filter((l) =>
    cells.some((x) => x.checks.some((k) => k.label === l && failing(k))),
  )
  if (!shown.length) return []
  const items: Item[] = [{ indent, cells: ['check', ...cells.map((x) => t(label(x), c.dim))] }]
  for (const l of shown) {
    const row = cells.map((x) => {
      const k = x.checks.find((y) => y.label === l)
      if (!k) return t('–', c.dim)
      const count = checkCount(k, false)
      if (!failing(k)) return t(count)
      return t(count, k.outcome.status === 'not run' || !x.gated ? c.dim : c.red)
    })
    items.push({ indent, cells: [checkLabel(l), ...row] })
    const assertion = cells
      .map((x) => x.checks.find((y) => y.label === l))
      .map((k) => (k ? assertionOf(k) : ''))
      .find(Boolean)
    if (assertion) items.push({ indent: indent + 2, free: t(assertion, c.dim) })
  }
  const passed = labels.length - shown.length
  if (passed) items.push({ indent, free: t(`+${passed} more passed`, c.dim) })
  return table(items, width)
}

/** Tools, agent time and tokens per cell, when each has enough trials and it matters. */
function effortTable(
  c: Colors,
  cells: CellResult[],
  label: (cell: CellResult) => string,
  indent: number,
  failed: boolean,
  width: number,
): string[] {
  if (cells.length < 2 || cells.some((x) => !x.effort)) return []
  const effortMoved = (x: CellResult) =>
    (x.measures ?? []).some(
      (m) =>
        (m.measure === 'tools' || m.measure === 'agentMs' || m.measure === 'tokens') &&
        (m.verdict === 'better' || m.verdict === 'worse'),
    )
  if (!failed && !cells.some(effortMoved)) return []
  const tokens = cells.some((x) => x.effort?.tokens !== null)
  const llmCalls = cells.some((x) => x.effort?.llmCalls !== undefined)
  const waiting = cells.some((x) => (x.effort?.waitingMs ?? 0) > 0)
  const n = (v: number | null | undefined, f: (v: number) => string) => (v == null ? '–' : f(v))
  const items: Item[] = [
    {
      indent,
      cells: [
        'effort',
        t('tools', c.dim),
        t('time', c.dim),
        ...(llmCalls ? [t('LLM calls', c.dim)] : []),
        ...(tokens ? [t('tokens', c.dim)] : []),
        ...(waiting ? [t('waiting', c.dim)] : []),
      ],
    },
    ...cells.map((x) => ({
      indent,
      cells: [
        label(x),
        n(x.effort?.tools, formatCount),
        n(x.effort?.agentMs, formatSeconds),
        ...(llmCalls ? [n(x.effort?.llmCalls, formatCount)] : []),
        ...(tokens ? [n(x.effort?.tokens, formatTokens)] : []),
        ...(waiting ? [n(x.effort?.waitingMs, formatSeconds)] : []),
      ],
    })),
  ]
  return table(items, width)
}

/**
 * `failed`: the eval didn't pass, so its effort prints. `explained`: the cells whose errors the
 * case rows above already show.
 */
type BodyOptions = { failed: boolean; verbose: boolean; explained: Set<string> }

/**
 * A variant's comparison with its baseline beyond pass rate: `5× faster · judge "tidy" +0.12`. Only
 * the measures that hold; `verbose` adds the ones that only lean, each `(leans)`. A judged check
 * reads as its judge's score, not again as its pass rate.
 */
function versus(measures: readonly Measure[] | null, verbose: boolean): string {
  const shown = (measures ?? []).filter(
    (m) =>
      m.measure !== 'pass' &&
      (m.verdict === 'better' || m.verdict === 'worse' || (verbose && m.verdict === 'leans')),
  )
  const judged = new Set(shown.filter((m) => m.measure === 'judge').map((m) => m.label))
  return shown
    .filter((m) => m.measure !== 'check' || !judged.has(m.label))
    .map((m) => (m.verdict === 'leans' ? `${m.text} (leans)` : m.text))
    .join(' · ')
}

type CompareEnvironment = { label: string; count: string; effect: Text; vs: string }

/** An environments table's header and a row per environment, with a `vs baseline` column when some environment has one. */
function environmentItems(
  c: Colors,
  indent: number,
  head: string,
  environments: CompareEnvironment[],
): Row[] {
  const column = environments.some((a) => a.vs)
  return [
    { indent, cells: [head, t('pass', c.dim), ...(column ? ['', t('vs baseline', c.dim)] : [])] },
    ...environments.map((a) => ({
      indent,
      cells: [a.label, a.count, ...(column ? [a.effect, a.vs] : a.effect.text ? [a.effect] : [])],
    })),
  ]
}

/** Measure a change: a row per environment with its effect, the check matrix and the effort table. */
function measureBody(c: Colors, cells: CellResult[], indent: number, o: BodyOptions): string[] {
  const label = labeler(cells, ['environment', 'sandbox'])
  const [head, ...rows] = environmentItems(
    c,
    indent,
    'environment',
    cells.map((cell) => ({
      label: label(cell),
      count: cellCount(cell),
      effect: gatedEffect(c, cell),
      vs: versus(cell.measures, o.verbose),
    })),
  )
  const environments: Item[] = head ? [head] : []
  for (const [i, cell] of cells.entries()) {
    const row = rows[i]
    if (row) environments.push(row)
    const stats = o.verbose ? statsLine(cell, cells) : null
    if (stats) environments.push({ indent: indent + 2, free: t(stats, c.dim) })
    for (const err of o.explained.has(cell.key) ? [] : cell.errors) {
      environments.push({
        indent: indent + 2,
        free: t(`${errorKind(err)}  ${errorText(err)}`, c.dim),
      })
    }
  }
  const labels = [
    ...cells.map(label),
    ...cells.flatMap((x) => x.checks.filter(failing).map((k) => checkLabel(k.label))),
  ]
  const width = Math.max(LABEL, ...labels.map((l) => indent + l.length))
  return [
    ...table(environments, width),
    ...checkMatrix(c, cells, label, indent, width),
    ...effortTable(c, cells, label, indent, o.failed, width),
  ]
}

/** Compare harnesses with environments: a heading per harness, its environments as Measure a change under it. */
function bothBody(c: Colors, cells: CellResult[], indent: number, o: BodyOptions): string[] {
  const harnessOf = labeler(cells, ['harness', 'sandbox'])
  const groups = new Map<string, CellResult[]>()
  for (const cell of cells)
    groups.set(harnessOf(cell), [...(groups.get(harnessOf(cell)) ?? []), cell])
  return [...groups].flatMap(([harness, group]) => [
    `${' '.repeat(indent)}${harness}`,
    ...measureBody(c, group, indent + 2, o),
  ])
}

/** Free-text answers shown per question; the rest are in the record. */
const ANSWERS_SHOWN = 3

function trialQuestionLines(c: Colors, q: TrialQuestionResult, indent: number): string[] {
  const pad = ' '.repeat(indent)
  const head = `${pad}${c.dim('question')}  ${clip(q.question, 100)}`
  const failed =
    q.error === null
      ? []
      : [`${pad}  ${c.yellow(`${q.failed} of ${q.asked} not answered: ${clip(q.error, 200)}`)}`]
  if (q.choices) {
    const tally = q.choices.map((t) => `${t.choice} ${t.n}`).join(' · ')
    return [head, `${pad}  ${tally}`, ...failed]
  }
  const shown = q.answers.slice(0, ANSWERS_SHOWN)
  const rows = table(
    shown.map((a) => ({
      indent: indent + 2,
      cells: [a.trial, clip(a.text.replace(/\s+/g, ' '), 100)],
    })),
  )
  const more = q.answers.length - shown.length
  const rest = more ? [`${pad}  ${c.dim(`${more} more: reeval query trial_answers`)}`] : []
  return [head, ...rows, ...rest, ...failed]
}

function questionLines(
  c: Colors,
  questions: Array<QuestionResult | TrialQuestionResult>,
  indent: number,
): string[] {
  return questions.flatMap((q) => {
    if (q.kind === 'trials') return trialQuestionLines(c, q, indent)
    const pad = ' '.repeat(indent)
    const head = `${pad}${c.dim('question')}  ${clip(q.question, 100)}`
    if (q.votes === 0 && q.error === null) {
      return [
        head,
        `${pad}  ${c.dim('no pairs to judge: trials that failed their checks are left out')}`,
      ]
    }
    if (q.rates.length === 0 && q.error === null) {
      return [
        head,
        `${pad}  ${c.dim(`${q.votes} ${q.votes === 1 ? 'vote' : 'votes'}, every one a tie`)}`,
      ]
    }
    const cuts = new Set(q.rates.map((r) => r.cut)).size > 1
    const rows = table(
      q.rates.map((r) => ({
        indent: indent + 2,
        cells: [cuts ? `${r.name} (${r.cut})` : r.name, `won ${r.wins} of ${r.n}`],
      })),
    )
    const failed =
      q.error === null
        ? []
        : [`${pad}  ${c.yellow(`the model call failed: ${clip(q.error, 200)}`)}`]
    return [head, ...rows, ...failed]
  })
}

/**
 * Each observed name's tally: on its `observed` line with one cell, else a row per cell under it,
 * labeled as the cells table labels them.
 */
function observedLines(
  c: Colors,
  tallies: ObservedTally[],
  cells: CellResult[],
  indent: number,
): string[] {
  if (!tallies.length) return []
  const head = (name: string) => `${' '.repeat(indent)}${c.dim('observed')} ${clip(name, 40)}`
  if (cells.length <= 1) {
    return table(
      tallies.map((o, i) => ({
        indent,
        cells: [i ? '' : t('observed', c.dim), clip(o.name, 40), observedLine(o)],
      })),
    )
  }
  const label = labeler(cells, ['harness', 'environment', 'sandbox'])
  const byKey = new Map(cells.map((cell) => [cell.key, cell]))
  const names = [...new Set(tallies.map((o) => o.name))]
  return names.flatMap((name) => [
    head(name),
    ...table(
      tallies
        .filter((o) => o.name === name)
        .map((o) => {
          const cell = byKey.get(o.cell)
          return { indent: indent + 2, cells: [cell ? label(cell) : o.cell, observedLine(o)] }
        }),
    ),
  ])
}

/** A cell's counts summed over a family's cases. */
function pooledCount(cases: CaseResult[], key: string): string {
  let passed = 0
  let counted = 0
  for (const k of cases) {
    const cell = k.cells.find((x) => x.key === key)
    if (!cell) continue
    passed += cell.passed
    counted += cell.passed + cell.failed
  }
  return counted ? `${passed} of ${counted}` : 'not run'
}

/** A variant's effect, with the `minLift` its interval's low end fell short of, which fails it. */
function gatedEffect(
  c: Colors,
  environment: { effect: Effect | null; minLift: number | null; interval: Interval | null },
): Text {
  const effect = effectText(c, environment.effect)
  if (
    environment.minLift === null ||
    !environment.interval ||
    environment.interval.low >= environment.minLift
  )
    return effect
  const short = `not by minLift ${Math.round(environment.minLift * 100)}`
  return t(effect.text ? `${effect.text}, ${short}` : short, c.red)
}

/** `-v`: a variant's paired lift over the cases and its interval. */
const pairedStats = (p: PooledEnvironment) =>
  `paired over ${plural(p.pairs, 'case')}, 95% interval ${signedPoints(p.interval.low)}…${signedPoints(p.interval.high)} points`

/**
 * A family's variants pooled over its cases: a row per cell with its passes summed over the cases
 * and its variant's pooled effect.
 */
function pooledBody(
  c: Colors,
  e: EvalResult,
  kind: Layout['kind'],
  verbose: boolean,
  indent: number,
): string[] {
  const cases = e.cases ?? []
  const pooled = e.pooled ?? []
  if (!pooled.length) return []
  const columns = [
    ...new Map(cases.flatMap((k) => k.cells).map((cell) => [cell.key, cell])).values(),
  ]
  const label = labeler(columns, ['harness', 'environment', 'sandbox'])
  const byKey = new Map(pooled.map((p) => [p.key, p]))
  const [head, ...rows] = environmentItems(
    c,
    indent,
    kind === 'agents' ? 'agent' : 'environment',
    columns.map((col) => {
      const p = byKey.get(col.key)
      return {
        label: label(col),
        count: pooledCount(cases, col.key),
        effect: p ? gatedEffect(c, p) : t(''),
        vs: versus(p?.measures ?? null, verbose),
      }
    }),
  )
  const items: Item[] = head ? [head] : []
  for (const [i, col] of columns.entries()) {
    const p = byKey.get(col.key)
    const row = rows[i]
    if (row) items.push(row)
    if (p && verbose) items.push({ indent: indent + 2, free: t(pairedStats(p), c.dim) })
  }
  return table(items)
}

type Upstreams = NonNullable<CellResult['upstreams']>

/** `Anthropic 12 · Amazon Bedrock 3`: each upstream provider and how many calls it served, summed. */
function upstreamList(counts: Upstreams): string {
  const total = new Map<string, number>()
  for (const u of counts) total.set(u.provider, (total.get(u.provider) ?? 0) + u.calls)
  return [...total].map(([provider, calls]) => `${provider} ${calls}`).join(' · ')
}

/**
 * Which upstream providers a gateway said served each harness's calls and its judge's, a line per
 * harness, so a run OpenRouter spread over several shows it. None where the gateway named none.
 */
export function upstreamTexts(cells: CellResult[]): string[] {
  const by = new Map<string, { agent: Upstreams; judge: Upstreams }>()
  for (const cell of cells) {
    if (!cell.upstreams && !cell.judgeUpstreams) continue
    const seen = by.get(cell.harness) ?? { agent: [], judge: [] }
    seen.agent.push(...(cell.upstreams ?? []))
    seen.judge.push(...(cell.judgeUpstreams ?? []))
    by.set(cell.harness, seen)
  }
  return [...by].map(([harness, { agent, judge }]) => {
    const parts = [
      ...(agent.length ? [`served by ${upstreamList(agent)}`] : []),
      ...(judge.length ? [`judge served by ${upstreamList(judge)}`] : []),
    ]
    const label = by.size > 1 ? `${harness}  ` : ''
    return `${label}${parts.join('; ')}`
  })
}

const upstreamLines = (c: Colors, cells: CellResult[], indent: number): string[] =>
  upstreamTexts(cells).map((text) => `${' '.repeat(indent)}${c.dim(text)}`)

/**
 * One line pointing at the first capture whose page had page errors, and at the file that lists
 * them; the eval's other such captures are counted.
 */
export function pageErrorLines(c: Colors, cells: CellResult[], indent: number): string[] {
  const [first, ...rest] = cells.flatMap((cell) => cell.pageErrors ?? [])
  if (!first) return []
  const more = rest.length ? ` (+${plural(rest.length, 'more capture')})` : ''
  const head = `${plural(first.errors, 'page error')} in capture "${first.capture}"`
  return [`${' '.repeat(indent)}${c.yellow(head)} ${c.dim(`→ ${first.file}${more}`)}`]
}

/** Each trial's workspace that wasn't kept, or was kept without a file, once per reason. */
export const workspaceLines = (c: Colors, cells: CellResult[], indent: number): string[] =>
  [...new Set(cells.flatMap((cell) => cell.workspaceNotes ?? []))].map(
    (text) => `${' '.repeat(indent)}${c.yellow(text)}`,
  )

const nameOf = (e: Pick<EvalResult, 'group' | 'name' | 'template'>) =>
  [...e.group, e.template ?? e.name].join(' › ')

/** The eval's head: `✓`, `✗` or `·`, its name, the number its target judges, and the target. */
function headCells(c: Colors, e: EvalResult): Array<string | Text> {
  const s = standing(e)
  const number = t(targetNumber(e), s === 'infra' ? c.yellow : s === 'skipped' ? c.dim : undefined)
  return s === 'skipped'
    ? [nameOf(e), number]
    : [nameOf(e), number, t(targetLabel(e.target), c.dim)]
}

/** The eval's mark, as the run list's: `○` for one the run's interrupt canceled. */
const markOf = (c: Colors, e: EvalResult) => {
  if (e.outcome === 'canceled' && !e.todo && !e.notRun) return show(t('○', c.yellow))
  const s = standing(e)
  return show(t(MARK[s], s === 'pass' ? c.green : s === 'fail' ? c.red : c.dim))
}

/** Each eval's head line, the columns aligned across them. */
const heads = (c: Colors, evals: EvalResult[]) =>
  table(
    evals.map((e) => ({ indent: 0, cells: headCells(c, e) })),
    0,
  ).map((line, i) => {
    const e = evals[i]
    return e ? `${markOf(c, e)} ${line}` : line
  })

/**
 * A row per case that cost the eval points (every case with `-v`): its score and why, with what
 * the task threw under it (its meta, the turn, and its stack's own frames for an error that isn't
 * an `EvalError`, or with `-v`) and a failed check's message.
 */
function caseLines(c: Colors, e: EvalResult, cells: CellResult[], verbose: boolean): string[] {
  const byKey = new Map(cells.map((cell) => [cell.key, cell]))
  const target = cells.filter((cell) => e.scored.some((a) => a.cell === cell.key))
  const label = labeler(target, ['harness', 'environment', 'sandbox'])
  const cellLabel = (key: string) => {
    const cell = byKey.get(key)
    return cell ? label(cell) : key
  }
  const items: Item[] = notRunCases(e).map((label) => ({
    indent: 4,
    cells: [label, t('not run', c.dim)],
  }))
  for (const row of caseRows(e, cellLabel, verbose)) {
    const score = row.score === null ? t(row.status, c.yellow) : t(rowPercent(e, row.score))
    items.push({ indent: 4, cells: [row.label, score, ...(row.text ? [row.text] : [])] })
    if (row.failure) {
      const f = failureFacts(row.failure)
      const frames = verbose || row.failure.name ? f.frames : []
      for (const text of [...f.meta, f.turn, ...frames]) {
        items.push({ indent: 6, free: t(clip(text, ASSERTION_MAX), c.dim) })
      }
    }
    for (const k of row.checks) {
      const message = k.message.trim().split('\n')[0]?.trim()
      if (!message) continue
      const said = clip(k.label ? `"${k.label}": ${message}` : message, ASSERTION_MAX)
      const shown = [said, k.at && location(k.at)].filter(Boolean).join(' · ')
      items.push({ indent: 6, free: t(shown, c.dim) })
    }
  }
  return table(items, 0)
}

/**
 * A compare's environments, their failed checks and effort, pooled over the cases on a family; none for
 * an eval that compares nothing. Each environment lists the errors of its cells not in `explained`, which
 * the case rows above it already show.
 */
export function environmentLines(
  c: Colors,
  e: EvalResult,
  verbose: boolean,
  explained: Set<string>,
  indent: number,
): string[] {
  const shape = layout(e.across, e.family, false)
  const all = e.cells ?? (e.cases ?? []).flatMap((k) => k.cells)
  const cells = [...new Map(all.map((cell) => [cell.key, cell])).values()]
  const o = { failed: e.outcome !== 'pass', verbose, explained }
  if (e.family) return pooledBody(c, e, shape.kind, verbose, indent)
  if (shape.kind === 'measure') return measureBody(c, cells, indent, o)
  if (shape.kind === 'both') return bothBody(c, cells, indent, o)
  return []
}

/**
 * The lines under an eval's head: its cases on a miss (`expands`), a compare's environments (pooled over
 * the cases on a family), then what else it recorded. `loose` when it has more than case rows,
 * so a blank line sets it apart.
 */
function evalBody(c: Colors, e: EvalResult, verbose: boolean): { lines: string[]; loose: boolean } {
  if (e.todo || e.notRun || e.outcome === 'skipped') return { lines: [], loose: false }
  const all = e.cells ?? (e.cases ?? []).flatMap((k) => k.cells)
  const cells = [...new Map(all.map((cell) => [cell.key, cell])).values()]
  const rows = expands(e, verbose) || notRunCases(e).length ? caseLines(c, e, cells, verbose) : []
  const explained = new Set(rows.length ? e.scored.map((a) => a.cell) : [])
  const environments = environmentLines(c, e, verbose, explained, 2)
  const extras = [
    ...questionLines(c, e.questions, 2),
    ...(e.family ? [] : observedLines(c, e.observations, cells, 2)),
  ]
  return {
    lines: [
      ...rows,
      ...environments,
      ...upstreamLines(c, all, 2),
      ...pageErrorLines(c, all, 2),
      ...workspaceLines(c, all, 2),
      ...extras,
    ],
    loose: environments.length + extras.length > 0,
  }
}

/** One eval's block: its head, then the lines under it. */
export function evalBlock(c: Colors, e: EvalResult, verbose = false): string[] {
  return [heads(c, [e])[0] ?? '', ...evalBody(c, e, verbose).lines]
}

/**
 * `3 evals · 1 on target · 1 below · 1 report only`: the run's errors outside any eval first,
 * then the evals that didn't count, zeros left out.
 */
export function tallyLine(c: Colors, tally: SuiteResult['tally']): string {
  if (!tally.evals && !tally.errors) return 'no evals ran'
  const paint = { red: c.red, green: c.green, yellow: c.yellow, dim: c.dim }
  return tallyParts(tally)
    .map((p) => (p.tone ? paint[p.tone](p.text) : p.text))
    .join(c.dim(' · '))
}

/**
 * Every eval's block in file-path order, then source order, their heads in one aligned table; a
 * blank line around each with more than case rows under it.
 */
export function renderBlocks(suite: SuiteResult, opts: RenderOptions): string[] {
  const c = colors(opts.color)
  const evals = suite.files.flatMap((f) => [...f.evals].sort((a, b) => a.order - b.order))
  const lines = heads(c, evals)
  const blocks = evals.map((e, i) => ({ head: lines[i] ?? '', ...evalBody(c, e, opts.verbose) }))
  const out: string[] = []
  blocks.forEach((block, i) => {
    const prev = blocks[i - 1]
    if (prev && (prev.loose || block.loose)) out.push('')
    out.push(block.head, ...block.lines)
  })
  return out
}

/**
 * A run's result: its errors outside any eval, its blocks, then the tally and the remarks, which
 * come from the record and the history.
 */
export function render(
  suite: SuiteResult,
  remarks: RunRemarks | null,
  opts: RenderOptions,
): string[] {
  const c = colors(opts.color)
  const blocks = renderBlocks(suite, opts)
  return [
    ...suite.errors.flatMap((error) => [c.red(`error: ${error}`), '']),
    ...blocks,
    ...(blocks.length ? [''] : []),
    ...(opts.notes ?? []),
    tallyLine(c, suite.tally),
    ...remarkLines(c, suite, remarks, opts.verbose),
  ]
}
