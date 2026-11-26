// What the terminal prints of an eval against its target beside the number it's judged on
// (`../view/target.ts`): a row per case that cost it points, and the run's count of evals on and
// below their targets. Plain text; `layout.ts` and `status.ts` paint and place it.

import { plural } from '../text.ts'
import type { AttemptFailure } from '../types.ts'
import { scorePercent } from '../view/report/format.ts'
import {
  type EvalResult,
  failureHeadline,
  type ScoredAttempt,
  type SuiteTally,
} from '../view/suite.ts'

/** `evals/a.eval.ts:12` from `source:evals/a.eval.ts#L12`. */
export const location = (at: string) => at.replace(/^source:/, '').replace(/#L(\d+)$/, ':$1')

/** `67%`: rounded, but a score under `threshold` or under 1 never reads as reaching it. */
export const percent = scorePercent

/**
 * A case row's score against the threshold each attempt meets (a metric's applies to the mean,
 * which a row under it shares), so a row under it never reads as reaching it.
 */
export const rowPercent = (e: EvalResult, score: number) => percent(score, e.target.threshold)

const counts = (a: ScoredAttempt) => a.score !== null

/** `✓` and `✗` for a blocking target's pass and miss, `–` for one that didn't run, else a neutral `·`. */
export const MARK = { pass: '✓', fail: '✗', report: '·', infra: '·', skipped: '–' } as const

/** Its cases print on a miss, an outcome other than a pass, a task that threw, or with `-v`. */
export const expands = (e: EvalResult, verbose: boolean) =>
  e.scored.length > 0 &&
  (verbose || (e.outcome !== 'pass' && e.outcome !== 'skipped') || e.scored.some((a) => a.failure))

/** One case (an attempt, on an eval without cases) and what cost it points. */
export type CaseRow = {
  /**
   * `#npm`, or `#2` for an attempt of an eval without cases, then the cell after ` · ` when the
   * target has several (the cell alone for one attempt of each).
   */
  label: string
  /** The case's mean score; null when no attempt of it counted. */
  score: number | null
  /** In place of a score when none counted: `infra error`, `canceled`. */
  status: string
  /**
   * What cost it points: what the task threw, else the graders under 1 (`no-new-deps 0%, tests
   * 50% (required)`) and the checks it failed, else the error it ended on.
   */
  text: string
  /** What the task threw, for the lines under the row. */
  failure: AttemptFailure | null
  /**
   * Each failed check's message, when checks are what cost it: `label` names the check when it
   * failed beside others, and `at` is where its `expect` is (`source:evals/a.eval.ts#L12`).
   */
  checks: CheckMessage[]
}

export type CheckMessage = { label: string | null; message: string; at: string | null }

const ERROR_WORD: Record<NonNullable<ScoredAttempt['error']>['kind'], string> = {
  assertion: 'error',
  judge: 'judge error',
  timeout: 'timed out',
  aborted: 'canceled',
  infra: 'infra error',
}

/**
 * A grader's mean over the attempts, an attempt that didn't lose points on it counting 1: `tests
 * 50%`, or `judge "Explains retries" 40%` for a judge.
 */
function graderText(group: ScoredAttempt[], threshold: number | undefined): string[] {
  const runs = group.filter(counts)
  const names = [...new Set(runs.flatMap((a) => a.lost.map((g) => g.grader)))]
  return names.map((name) => {
    const own = runs.map((a) => a.lost.find((g) => g.grader === name))
    const shown = own.some((g) => g?.kind === 'judge')
      ? `judge "${name.replace(/^judge:/, '')}"`
      : name
    const errored = own.find((g) => g?.error)
    if (errored && own.every((g) => g?.error)) return `${shown} errored`
    const mean = own.reduce((s, g) => s + (g ? g.score : 1), 0) / runs.length
    return `${shown} ${percent(mean, threshold)}${own.some((g) => g?.required) ? ' (required)' : ''}`
  })
}

function rowOf(label: string, group: ScoredAttempt[], threshold: number | undefined): CaseRow {
  const runs = group.filter(counts)
  const score = runs.length ? runs.reduce((s, a) => s + (a.score ?? 0), 0) / runs.length : null
  const thrown = group.filter((a) => a.failure)
  const errored = group.find((a) => a.error)
  const status = score === null && errored?.error ? ERROR_WORD[errored.error.kind] : ''
  const several = (n: number) => (group.length > 1 ? ` (${n} of ${group.length} runs)` : '')
  const failure = thrown[0]?.failure ?? null
  if (failure) {
    const text = `${failureHeadline(failure)}${several(thrown.length)}`
    return { label, score, status, text, failure, checks: [] }
  }
  const checks = [...new Set(runs.flatMap((a) => a.failedChecks.map((k) => k.label)))]
  const text = [...graderText(group, threshold), ...checks.map((k) => `"${k}" failed`)].join(', ')
  if (errored?.error && (status || !text)) {
    const { kind, message } = errored.error
    const text = `${status || kind === 'assertion' ? '' : `${ERROR_WORD[kind]}: `}${message}`
    return { label, score, status, text, failure: null, checks: [] }
  }
  const failed = runs.flatMap((a) => a.failedChecks)
  const messages = checks.flatMap((name): CheckMessage[] => {
    const k = failed.find((f) => f.label === name && f.message)
    if (!k?.message) return []
    const prefix = `${name}: `
    const message = k.message.startsWith(prefix) ? k.message.slice(prefix.length) : k.message
    return [{ label: checks.length > 1 ? name : null, message, at: k.at }]
  })
  return { label, score, status, text, failure: null, checks: messages }
}

/** The cases a stopped run never reached, as `#key`: they have no attempt to score. */
export const notRunCases = (e: EvalResult): string[] =>
  (e.cases ?? []).filter((k) => k.notRun).map((k) => `#${k.label}`)

/** `1–3, 5`: run numbers with their runs of consecutive numbers as ranges. */
function runRanges(ns: number[]): string {
  const sorted = [...new Set(ns)].sort((a, b) => a - b)
  const out: string[] = []
  for (let i = 0; i < sorted.length; ) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === (sorted[j] ?? 0) + 1) j++
    out.push(j > i ? `${sorted[i]}–${sorted[j]}` : String(sorted[i]))
    i = j + 1
  }
  return out.join(', ')
}

/**
 * A row per case, or per attempt without cases, with the cell when the target has several: every
 * one with `all`, else those under 100% or with no score. Attempts without cases that read alike
 * (the same cell, score and why) share one row, `#1–4`.
 */
export function caseRows(
  e: EvalResult,
  cellLabel: (key: string) => string,
  all: boolean,
): CaseRow[] {
  const cells = new Set(e.scored.map((a) => a.cell)).size > 1
  const groups = new Map<string, ScoredAttempt[]>()
  for (const a of e.scored) {
    const key = a.case === null ? `${a.cell}\0${a.n}` : `${a.case}\0${a.cell}`
    groups.set(key, [...(groups.get(key) ?? []), a])
  }
  const rows: Array<{ row: CaseRow; cell: string; key: string | null; ns: number[] | null }> = []
  for (const group of groups.values()) {
    const [a] = group
    if (!a) continue
    const row = rowOf('', group, e.target.threshold)
    const like =
      a.case === null
        ? rows.find(
            (r) =>
              r.ns &&
              r.cell === a.cell &&
              r.row.score === row.score &&
              r.row.status === row.status &&
              r.row.text === row.text,
          )
        : undefined
    if (like?.ns) like.ns.push(a.n)
    else rows.push({ row, cell: a.cell, key: a.case, ns: a.case === null ? [a.n] : null })
  }
  return rows
    .map(({ row, cell, key, ns }) => {
      const several = e.scored.some((a) => a.n > 1)
      const id = ns ? (several || !cells ? `#${runRanges(ns)}` : '') : `#${key}`
      const label = [id, cells ? cellLabel(cell) : ''].filter(Boolean).join(' · ')
      return { ...row, label }
    })
    .filter((r) => all || r.score === null || r.score < 1)
}

/**
 * A stack frame in the project's own files, whose paths the record made relative: not Node's, a
 * package's or reeval's.
 */
export const ownFrame = (line: string) =>
  line.startsWith('at ') &&
  /:\d+:\d+\)?$/.test(line) &&
  !/node:|node_modules|file:|\(\/|^at \/|[A-Za-z]:\\/.test(line)

/** The most of a stack's frames a throw shows. */
export const STACK_FRAMES = 5

/**
 * What the task threw, under its reason: an `EvalError`'s meta as `key: value`, the turn it threw
 * after, and its stack's frames in the project.
 */
export function failureFacts(f: AttemptFailure): {
  meta: string[]
  turn: string
  frames: string[]
} {
  return {
    meta: Object.entries(f.meta ?? {}).map(([key, value]) => {
      const text = typeof value === 'string' ? value : JSON.stringify(value)
      return `${key}: ${text.replace(/\s+/g, ' ').trim()}`
    }),
    turn: f.turn ? `after turn ${f.turn}` : 'before the first turn',
    frames: (f.stack ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(ownFrame)
      .slice(0, STACK_FRAMES),
  }
}

/** `3 evals · 1 on target · 1 below · 1 report only`, then those that didn't count and the run's errors. */
export function tallyParts(
  t: SuiteTally,
): Array<{ text: string; tone?: 'red' | 'green' | 'yellow' | 'dim' }> {
  const parts = [
    { n: t.errors, text: plural(t.errors, 'run error'), tone: 'red' as const },
    { n: t.evals, text: plural(t.evals, 'eval') },
    { n: t.onTarget, text: `${t.onTarget} on target`, tone: 'green' as const },
    { n: t.below, text: `${t.below} below`, tone: 'red' as const },
    { n: t.reportOnly, text: `${t.reportOnly} report only`, tone: 'dim' as const },
    { n: t.infraError, text: plural(t.infraError, 'infra error'), tone: 'yellow' as const },
    { n: t.canceled, text: `${t.canceled} canceled`, tone: 'yellow' as const },
    { n: t.skipped, text: `${t.skipped} skipped`, tone: 'dim' as const },
  ]
  return parts.filter((p) => p.n > 0).map(({ text, tone }) => (tone ? { text, tone } : { text }))
}
