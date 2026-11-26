// `reeval run`'s results as a status list: one row per eval, grouped under its file, each with
// `✓` or `✗` (a blocking target's pass or miss) or `·`, its name, the number its target judges
// (`86% ≥ 80%`, `4/5 runs at 100%, worst 70%`, `target.ts`) and the target, and a detail of plain
// sentences from the record. The sentences come from fixed templates (no model), so the same run
// always reads the same:
//
// - On a miss, a task that threw, or with `-v`, a row per case (of the target's cells: the
//   variants on a compare) that cost the eval points, unmarked as in `reeval show`: its score, then
//   what the task threw, the error it ended on, or the graders under 100% and the checks that
//   failed, with an `EvalError`'s meta and the turn it threw after under it. Past eight rows, a
//   count of the rest.
// - A compare then reads its arms as `reeval show` prints them (`layout.ts`'s `armLines`): each
//   arm's pass count and effect, the checks that failed in some arm and, when effort moved or the
//   eval missed, the effort table; with `-v`, each cell's difference and 95% interval. Under an
//   arm, the errors of its cells that no case row shows.
// - An eval whose target doesn't block prints its answers (questions, `c.observe`) even in a list
//   printed once.
// - Under the case rows, what a row can't show: a turn's error, and the whole of an error that
//   runs over several lines.
// - `Worth knowing:` the eval's remarks, each its brief unless the detail is full, then each check
//   that needed its retries (`"label" passed on try 2 of 3.`) and the first capture whose page had
//   errors (`2 page errors in capture "home" → <file>`, with `(+N more captures)`), then the
//   upstream providers a gateway named (`served by Anthropic 2; judge served by Google 1`, a line
//   per harness when several); one item prints on the `Worth knowing:` line itself.
//
// Only the cells that decide the outcome count: the target's (the variants on a compare), or every
// cell of a study.

import stringWidth from 'string-width'
import type { RunRecord } from '../history/types.ts'
import { targetLabel } from '../target.ts'
import { clip, formatDuration, plural } from '../text.ts'
import type { ErrorKind } from '../types.ts'
import { formatCost, runCost } from '../view/cost.ts'
import { formatUsage } from '../view/model.ts'
import { type ObservedTally, observedLine } from '../view/observations.ts'
import type { Remark, RunRemarks } from '../view/remarks.ts'
import type {
  AttemptQuestionResult,
  CellError,
  CellResult,
  EvalResult,
  QuestionResult,
  SuiteResult,
} from '../view/suite.ts'
import { colors } from './colors.ts'
import { armLines, labeler as cellLabeler, checkLabel, upstreamTexts } from './layout.ts'
import { shownRemarks } from './remarks.ts'
import {
  caseRows,
  expands,
  failureFacts,
  location,
  notRunCases,
  rowPercent,
  standing,
  tallyParts,
  targetNumber,
} from './target.ts'

/** `failing`: still running, with a run that already failed; its outcome isn't decided yet. */
export type StatusIcon =
  | 'queued'
  | 'running'
  | 'failing'
  | 'pass'
  | 'fail'
  | 'observe'
  | 'skipped'
  | 'canceled'

/**
 * A status glyph before a detail line's text: `spin` is an attempt reeval is waiting on (the
 * interactive list animates it), `fail` a red `✗`, `miss` a dim one (a failure that doesn't fail
 * the eval, such as a compare's control), `error` a red `✗` for a timeout or infra error.
 */
export type DetailMark = 'spin' | 'pass' | 'fail' | 'miss' | 'error' | 'queued' | 'skipped'

/** A detail line: its depth under the row, and how it's painted. */
export type DetailLine = {
  depth: 0 | 1 | 2
  text: string
  tone?: 'dim' | 'red' | 'heading'
  mark?: DetailMark
  /** Dimmed after the text, past a ` · `. */
  note?: string
  /**
   * `full`: only with `-v`, or once the interactive list's open eval is opened again (file
   * excerpts, snapshot paths, a remark's whole sentence). `compact`: only without them (its short
   * form).
   */
  only?: 'compact' | 'full'
  /**
   * Its part in a case table: the heading, a case's row, or the count of the cases the compact
   * detail leaves out. The interactive list shows its own number of case rows and no count.
   */
  cases?: 'head' | 'row' | 'more'
  /**
   * A case row past the compact detail's eight, or their count, without `-v`: a full detail that
   * isn't `-v` (`--ui agent`'s) still leaves the rows out and prints the count.
   */
  capped?: boolean
}

/** The lines a detail shows, compact or `full`. */
export const shownDetail = (lines: DetailLine[], full: boolean, capped = false): DetailLine[] =>
  lines.filter((l) =>
    capped && l.capped ? l.only === 'compact' : !l.only || (l.only === 'full') === full,
  )

export type StatusRow = {
  /** The eval's id, or the family's. */
  id: string
  name: string
  icon: StatusIcon
  /** `86% ≥ 80%`, `4/5 runs at 100%, worst 70%`, `2 of 4 runs done`, `skipped`. */
  summary: string
  /** `regression(1)`, the target the summary is judged against, painted dim after it. */
  target?: string
  /** Its cases cost it its target or a task threw, so a list printed once shows its detail. */
  missed?: boolean
  detail: DetailLine[]
  /** It has remarks, under `Worth knowing:`, which a list printed once shows even on a pass. */
  remarks: number
  /** A compare, whose detail (the control and its variants) a list printed once always shows. */
  compare: boolean
  /** An eval whose target doesn't block, with answers (questions, `c.observe`), which a list printed once shows. */
  answers?: boolean
}

export type StatusFile = { path: string; rows: StatusRow[] }

export type StatusList = {
  files: StatusFile[]
  /** Errors outside any eval: an eval file that didn't load, a stray rejection. */
  errors: string[]
  /** `Done in 1m 05s · 3 evals · 2 on target · 1 below · 232k in · 3,026 out`. */
  done: string
  /** Incomplete, budget and interrupted notes, then where the results are. */
  notes: string[]
  /** Concerns the cap left out of the eval details. */
  hiddenRemarks: number
}

const ERROR_VERB: Record<ErrorKind | 'turn', string> = {
  assertion: 'failed',
  timeout: 'timed out',
  aborted: 'canceled',
  infra: 'hit an infrastructure error',
  judge: 'could not be judged',
  turn: 'ended a turn with an error',
}

const MESSAGE_LINES = 4
const LINE_MAX = 160

/** `cursor (composer-2.5)`, from the record's cell. */
function harnessLabel(record: RunRecord, cell: CellResult): string {
  const model = record.evals
    .flatMap((e) => e.cells)
    .find((c) => c.key === cell.key && c.harness === cell.harness)?.model
  return model && model !== cell.harness ? `${cell.harness} (${model})` : cell.harness
}

/** The cells an eval's outcome reads: the gated ones, or every cell of a study. */
function deciding(cells: CellResult[]): CellResult[] {
  const gated = cells.filter((c) => c.gated)
  return gated.length ? gated : cells
}

const cellsOf = (e: EvalResult): CellResult[] => e.cells ?? (e.cases ?? []).flatMap((k) => k.cells)

const padColumns = (text: string, width: number) =>
  `${text}${' '.repeat(Math.max(0, width - stringWidth(text)))}`

/** Rows of cells padded to one column each, two spaces apart, measured in terminal columns. */
export function columns(rows: string[][]): string[] {
  const widths = rows[0]?.map((_, i) => Math.max(...rows.map((r) => stringWidth(r[i] ?? '')))) ?? []
  return rows.map((r) =>
    r
      .map((cell, i) => padColumns(cell, widths[i] ?? 0))
      .join('  ')
      .trimEnd(),
  )
}

/**
 * A compare's arms as `reeval show` prints them, each listing the errors of its cells not in
 * `explained`.
 */
const compareLines = (e: EvalResult, verbose: boolean, explained: Set<string>): DetailLine[] =>
  armLines(colors(false), e, verbose, explained, 2).map((text) => ({
    depth: 0,
    text: text.slice(2),
  }))

/** A message's first lines, without the label it repeats or a command's empty output headings. */
function messageLines(text: string, label = '', max = LINE_MAX): string[] {
  const own = label && text.startsWith(`${label}: `) ? text.slice(label.length + 2) : text
  return own
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !/^--- (stderr|stdout) ---$/.test(l.trim()))
    .slice(0, MESSAGE_LINES)
    .map((l) => clip(l, max))
}

/** A failed command's first line on stderr, which usually says why, before what followed from it. */
function stderrHead(message: string): string | undefined {
  const section = /\n--- stderr ---\n([\s\S]*?)(?:\n--- stdout ---\n|$)/.exec(message)?.[1] ?? ''
  return section
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean)
}

/** Cases the compact detail lists, a case row or case table's failed ones; the full detail lists every one. */
const CASES_SHOWN = 8

/**
 * What the case rows can't show of the errors no failed check explains: a turn's error, and the
 * whole of an error that runs over several lines. Never clipped: their remedy is often last.
 */
function errorLines(cells: CellResult[], failedEval: boolean): DetailLine[] {
  const by = new Map<string, CellError & { n: number }>()
  for (const c of cells) {
    for (const err of c.errors) {
      const key = `${err.kind}\n${err.message}`
      const e = by.get(key) ?? { ...err, n: 0 }
      e.n += err.attempts
      by.set(key, e)
    }
  }
  const shown = [...by.values()].filter(
    (e) =>
      e.kind === 'turn' ||
      (!e.failure && e.kind !== 'assertion' && e.message.trim().includes('\n')),
  )
  return shown.flatMap((e) => {
    const fail = e.kind === 'assertion'
    const mark = e.kind === 'aborted' ? 'skipped' : !failedEval ? 'miss' : fail ? 'fail' : 'error'
    const tone = fail || !failedEval ? 'dim' : 'red'
    return [
      { depth: 0, mark, text: `${plural(e.n, 'run')} ${ERROR_VERB[e.kind]}` } as const,
      ...messageLines(e.message, '', Number.POSITIVE_INFINITY).map(
        (text) => ({ depth: 1, text, tone }) as const,
      ),
      ...(e.failure ? failureLines(e.failure) : []),
    ]
  })
}

/**
 * A row per case that cost the eval points (every case with `-v`): `#key  70%  why`, unmarked as
 * in `reeval show`, then what the task threw and a failed check's message, with a failed
 * command's first stderr line.
 */
function caseDetail(e: EvalResult, cells: CellResult[], verbose: boolean): DetailLine[] {
  const byKey = new Map(cells.map((c) => [c.key, c]))
  const label = cellLabeler(
    cells.filter((c) => e.scored.some((a) => a.cell === c.key)),
    ['harness', 'arm', 'sandbox'],
  )
  const cellLabel = (key: string) => {
    const cell = byKey.get(key)
    return cell ? label(cell) : key
  }
  const rows = caseRows(e, cellLabel, verbose)
  const table = columns(
    rows.map((row) => [
      row.label,
      row.score === null ? row.status : rowPercent(e, row.score),
      row.text,
    ]),
  )
  const notRun = notRunCases(e).map(
    (label): DetailLine => ({ depth: 0, text: `${label}  not run`, tone: 'dim' }),
  )
  const hidden = rows.length - CASES_SHOWN
  const more: DetailLine[] =
    hidden > 0
      ? [
          {
            depth: 0,
            text: `+${hidden} more ${hidden === 1 ? 'case' : 'cases'} (-v)`,
            tone: 'dim',
            only: 'compact',
            ...(verbose ? {} : { capped: true }),
          },
        ]
      : []
  const caseLines = rows.flatMap((row, i): DetailLine[] => {
    const lines: DetailLine[] = [{ depth: 0, text: table[i] ?? '' }]
    if (row.failure) {
      const f = failureFacts(row.failure)
      for (const text of [...f.meta, f.turn]) {
        lines.push({ depth: 1, text: clip(text, LINE_MAX), tone: 'dim' })
      }
      const only = row.failure.name ? {} : { only: 'full' as const }
      for (const text of f.frames) lines.push({ depth: 1, text, tone: 'dim', ...only })
    }
    for (const k of row.checks) {
      const [first, ...rest] = messageLines(k.message)
      const said = k.label && first ? `"${k.label}": ${first}` : first
      const shown = [said, k.at ? location(k.at) : ''].filter(Boolean).join(' · ')
      if (shown) lines.push({ depth: 1, text: shown, tone: 'dim' })
      const stderr = stderrHead(k.message)
      if (stderr) lines.push({ depth: 1, text: `stderr: ${clip(stderr, LINE_MAX)}`, tone: 'dim' })
      const after = stderr ? rest.filter((l) => l.trim() !== stderr) : rest
      for (const line of after) lines.push({ depth: 1, text: line, tone: 'dim', only: 'full' })
    }
    const capped = verbose ? {} : { capped: true }
    return i < CASES_SHOWN ? lines : lines.map((l) => ({ ...l, only: 'full' as const, ...capped }))
  })
  return [...notRun, ...caseLines, ...more]
}

/** The most of a stack's frames a throw shows. */
const STACK_FRAMES = 5

/**
 * A stack frame in the project's own files, whose paths the record made relative: not Node's, a
 * package's or reeval's.
 */
const ownFrame = (line: string) =>
  line.startsWith('at ') &&
  /:\d+:\d+\)?$/.test(line) &&
  !/node:|node_modules|file:|\(\/|^at \/|[A-Za-z]:\\/.test(line)

/**
 * What the task threw, under its reason: an `EvalError`'s meta as `key: value`, the turn it
 * threw after, and its stack's frames in the project, which an `EvalError` shows only in full.
 */
function failureLines(f: NonNullable<CellError['failure']>): DetailLine[] {
  const meta = Object.entries(f.meta ?? {}).map(([key, value]) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return {
      depth: 2,
      text: clip(`${key}: ${text.replace(/\s+/g, ' ').trim()}`, LINE_MAX),
      tone: 'dim',
    } as const
  })
  const frames = (f.stack ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(ownFrame)
    .slice(0, STACK_FRAMES)
    .map((text) => ({ depth: 2, text, tone: 'dim', ...(f.name ? {} : { only: 'full' }) }) as const)
  return [
    ...meta,
    { depth: 2, text: f.turn ? `after turn ${f.turn}` : 'before the first turn', tone: 'dim' },
    ...frames,
  ]
}

/** `"npm test" passed on try 2 of 3.`: a check that needed its `c.exec` retries is flaky. */
function retriedLines(cells: CellResult[]): string[] {
  const seen = new Set<string>()
  return cells.flatMap((c) =>
    c.checks.flatMap((k) => {
      if (!k.retried || seen.has(k.label)) return []
      seen.add(k.label)
      return [`"${checkLabel(k.label)}" ${k.retried}.`]
    }),
  )
}

function pageErrorNotes(cells: CellResult[]): string[] {
  const [first, ...rest] = cells.flatMap((c) => c.pageErrors ?? [])
  if (!first) return []
  const more = rest.length ? ` (+${plural(rest.length, 'more capture')})` : ''
  return [
    `${plural(first.errors, 'page error')} in capture "${first.capture}" → ${first.file}${more}`,
  ]
}

/**
 * `Worth knowing:` on the line itself when there's one remark or note, else as a heading over
 * them. A remark with a short form (`brief`) gives it, and its whole sentence in the full detail.
 */
function remarkLines(remarks: Remark[], notes: string[]): DetailLine[] {
  const items = [
    ...remarks.map((r) => {
      const full = r.fix.edit
        ? `${r.text} Fix at ${location(r.fix.at)}: ${r.fix.edit}.`
        : `${r.text} At ${location(r.fix.at)}.`
      return { full, compact: r.brief ?? full }
    }),
    ...notes.map((text) => ({ full: text, compact: text })),
  ]
  if (!items.length) return []
  const one = items.length === 1
  const lines: DetailLine[] = one ? [] : [{ depth: 0, text: 'Worth knowing:', tone: 'heading' }]
  const depth = one ? 0 : 1
  const lead = one ? 'Worth knowing: ' : ''
  for (const { full, compact } of items) {
    if (compact === full) lines.push({ depth, text: `${lead}${full}` })
    else {
      lines.push({ depth, text: `${lead}${compact}`, only: 'compact' })
      lines.push({ depth, text: `${lead}${full}`, only: 'full' })
    }
  }
  return lines
}

/** A compare's failures are told apart by arm: `the control`, or the variant's name. */
const armOf = (c: CellResult) => (c.baseline ? 'the control' : (c.variant ?? c.environment))

const nameOf = (e: Pick<EvalResult, 'group' | 'name' | 'template'>) =>
  [...e.group, e.template ?? e.name].join(' › ')

function iconOf(e: EvalResult): StatusIcon {
  if (e.outcome === 'canceled' && !e.todo && !e.notRun) return 'canceled'
  const s = standing(e)
  if (s === 'skipped') return 'skipped'
  return s === 'report' || s === 'infra' ? 'observe' : s
}

export function evalRow(
  record: RunRecord,
  e: EvalResult,
  remarks: Remark[],
  verbose = false,
  host?: string,
): StatusRow {
  const cells = cellsOf(e)
  const decide = deciding(cells)
  const ran = decide.reduce((n, c) => n + c.passed + c.failed + c.infraError, 0)
  const compare = cells.some((c) => c.baseline)
  const failedEval = iconOf(e) === 'fail'
  const rowsShown = expands(e, verbose) || notRunCases(e).length > 0
  const target = cells.filter((c) => e.scored.some((a) => a.cell === c.key))
  const explained = new Set(rowsShown ? target.map((c) => c.key) : [])
  const notes = ran
    ? [
        ...retriedLines(decide),
        ...pageErrorNotes(decide),
        ...new Set(cells.flatMap((c) => c.workspaceNotes ?? [])),
        ...upstreamTexts(cells),
      ]
    : []
  const answers = [
    ...questionLines(e.questions ?? []),
    ...observedLines(e.observations ?? [], cells, (c) =>
      compare ? armOf(c) : harnessLabel(record, c),
    ),
  ]
  const detail = ran
    ? [
        ...(compare
          ? [
              ...(rowsShown ? caseDetail(e, cells, verbose) : []),
              ...(rowsShown ? errorLines(target, failedEval) : []),
              ...compareLines(e, verbose, explained),
            ]
          : [...caseDetail(e, cells, verbose), ...errorLines(decide, failedEval)]),
        ...(failedEval ? snapshotLines(cells, host) : []),
        ...answers,
        ...remarkLines(remarks, notes),
      ]
    : remarkLines(remarks, [])
  const judged = !e.todo && !e.notRun && e.outcome !== 'skipped' && e.outcome !== 'canceled'
  return {
    id: e.id,
    name: nameOf(e),
    icon: iconOf(e),
    summary: targetNumber(e),
    ...(judged ? { target: targetLabel(e.target) } : {}),
    ...(!compare && expands(e, false) ? { missed: true } : {}),
    detail,
    remarks: remarks.length + notes.length,
    compare,
    ...(ran && answers.length && !e.blocking ? { answers: true } : {}),
  }
}

/** Free-text answers shown per question; the rest are in the record. */
const ANSWERS_SHOWN = 3

/** Rows of `[label, text]` at `depth`, the labels padded to one column. */
const aligned = (
  depth: DetailLine['depth'],
  rows: Array<readonly [string, string]>,
): DetailLine[] => {
  const w = Math.max(0, ...rows.map(([label]) => label.length))
  return rows.map(([label, text]) => ({ depth, text: `${label.padEnd(w)}  ${text}` }))
}

/** Each question's answer: who won the pairs, the tally of choices, or the first answers. */
function questionLines(questions: Array<QuestionResult | AttemptQuestionResult>): DetailLine[] {
  return questions.flatMap((q): DetailLine[] => {
    const head = { depth: 0, text: `Question: ${clip(q.question, 100)}`, tone: 'heading' } as const
    if (q.kind === 'attempts') {
      const failed: DetailLine[] =
        q.error === null
          ? []
          : [
              {
                depth: 1,
                text: `${q.failed} of ${q.asked} not answered: ${clip(q.error, 200)}`,
                tone: 'red',
              },
            ]
      if (q.choices) {
        const tally = q.choices.map((t) => `${t.choice} ${t.n}`).join(' · ')
        return [head, { depth: 1, text: tally }, ...failed]
      }
      const shown = q.answers.slice(0, ANSWERS_SHOWN)
      const more = q.answers.length - shown.length
      return [
        head,
        ...aligned(
          1,
          shown.map((a) => [a.attempt, clip(a.text.replace(/\s+/g, ' '), 100)] as const),
        ),
        ...(more
          ? [{ depth: 1, text: `${more} more: reeval query attempt_answers`, tone: 'dim' } as const]
          : []),
        ...failed,
      ]
    }
    if (q.votes === 0 && q.error === null) {
      return [
        head,
        {
          depth: 1,
          text: 'No pairs to judge: tries that failed their checks are left out.',
          tone: 'dim',
        },
      ]
    }
    if (q.rates.length === 0 && q.error === null) {
      return [head, { depth: 1, text: `${plural(q.votes, 'vote')}, every one a tie.`, tone: 'dim' }]
    }
    const cuts = new Set(q.rates.map((r) => r.cut)).size > 1
    return [
      head,
      ...aligned(
        1,
        q.rates.map(
          (r) => [cuts ? `${r.name} (${r.cut})` : r.name, `won ${r.wins} of ${r.n}`] as const,
        ),
      ),
      ...(q.error === null
        ? []
        : [
            {
              depth: 1,
              text: `The model call failed: ${clip(q.error, 200)}`,
              tone: 'red',
            } as const,
          ]),
    ]
  })
}

/** Where a failed eval's first failed attempt's final workspace snapshot is, to open it. */
function snapshotLines(cells: CellResult[], host?: string): DetailLine[] {
  const [first, ...others] = cells.flatMap((c) => c.snapshots ?? [])
  if (!first) return []
  const more = others.length ? ` (+${others.length} more in summary.md)` : ''
  return [{ depth: 0, text: `Snapshot: ${onHost(first, host)}${more}`, tone: 'dim', only: 'full' }]
}

/** What `c.observe` recorded, each name's tally on one line, or a line per cell under it. */
function observedLines(
  tallies: ObservedTally[],
  cells: CellResult[],
  label: (c: CellResult) => string,
): DetailLine[] {
  if (!tallies.length) return []
  const byKey = new Map(cells.map((c) => [c.key, c]))
  const perCell = new Set(tallies.map((t) => t.cell)).size > 1
  const width = Math.max(...tallies.map((t) => clip(t.name, 40).length))
  const lines: DetailLine[] = [{ depth: 0, text: 'Observed:', tone: 'heading' }]
  if (!perCell) {
    for (const t of tallies) {
      lines.push({ depth: 1, text: `${clip(t.name, 40).padEnd(width)}  ${observedLine(t)}` })
    }
    return lines
  }
  for (const name of new Set(tallies.map((t) => t.name))) {
    lines.push({ depth: 1, text: clip(name, 40) })
    const rows = tallies
      .filter((t) => t.name === name)
      .map((t) => {
        const cell = byKey.get(t.cell)
        return [cell ? label(cell) : t.cell, observedLine(t)] as const
      })
    const w = Math.max(...rows.map(([who]) => who.length))
    for (const [who, line] of rows) lines.push({ depth: 2, text: `${who.padEnd(w)}  ${line}` })
  }
  return lines
}

/** `3 evals · 2 on target · 1 below`, from the suite's tally. */
export const tallyText = (suite: SuiteResult): string =>
  tallyParts(suite.tally)
    .map((p) => p.text)
    .join(' · ')

export type ListInput = {
  record: RunRecord
  suite: SuiteResult
  remarks: RunRemarks | null
  verbose: boolean
  /** Attempts the run planned that this resume's filters left out. */
  notRun?: number
  /** The host the run is on, when it isn't this one: the paths the list names are there. */
  host?: string
}

export function statusList(input: ListInput): StatusList {
  const { record, suite } = input
  const { shown, hidden } = shownRemarks(input.remarks?.remarks ?? [], suite.runId, input.verbose)
  const files = suite.files.map((f) => ({
    path: f.path,
    rows: f.evals.map((e) =>
      evalRow(
        record,
        e,
        shown.filter((r) => r.evalId === e.path),
        input.verbose,
        input.host,
      ),
    ),
  }))
  const tokens = formatUsage(record.cost.usage)
  const done = [
    `Done in ${formatDuration(record.durationMs)}`,
    tallyText(suite) || 'nothing ran',
    tokens,
    formatCost(runCost(record.cost)),
  ]
    .filter(Boolean)
    .join(' · ')
  const notes = [
    ...(input.notRun
      ? [
          `Incomplete: ${plural(input.notRun, 'attempt')} this resume’s filters left out ${input.notRun === 1 ? 'is' : 'are'} not run; reeval run --resume ${record.runId} runs ${input.notRun === 1 ? 'it' : 'them'}`,
        ]
      : []),
    ...(record.status === 'budget' && !input.notRun
      ? ['Budget reached: attempts that hadn’t started were skipped']
      : []),
    ...(record.status === 'interrupted' && !input.notRun
      ? ['Interrupted: attempts that hadn’t finished were canceled']
      : []),
  ]
  return { files, errors: suite.errors, done, notes, hiddenRemarks: hidden }
}

/** The pointers under the closing line: the studio and the run's summary.md. */
export const pointerLine = (summaryPath: string, host?: string) =>
  `Browse it: reeval studio · summary ${onHost(summaryPath, host)}`

/** A path the run printed, marked with the run's host when it's another one's. */
export const onHost = (path: string, host?: string) => (host ? `${path} (on ${host})` : path)
