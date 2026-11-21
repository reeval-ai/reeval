// Every arm against every other on one harness and sandbox, not only each variant against the
// control: a study of two skills asks how they differ from each other too. Derived from the
// record's cells, check tallies and attempts, so it costs no record field. Gating stays a
// variant against its control.
import type {
  AttemptRecord,
  CellRecord,
  CheckTally,
  CheckVerdict,
  EvalEntry,
  Lift,
} from '../history/types.ts'
import { containsZero, liftInterval, round3, taskMeanRate } from '../stats.ts'
import { cellSamples, contrastEffort, type EffortContrast } from './effort.ts'

/**
 * Where every counted attempt that answered a check passed it (`all`), none did, or some. An
 * attempt that never reached the check didn't answer it, so a side that never ran it has none.
 */
const sideOf = (t: CheckTally): 'all' | 'none' | 'some' | undefined => {
  const answered = t.pass + t.fail
  if (answered === 0) return undefined
  return t.pass === answered ? 'all' : t.pass === 0 ? 'none' : 'some'
}

/** Whether one check tells two cells apart; undefined when either side never ran it. */
export function checkVerdict(a: CheckTally, b: CheckTally): CheckVerdict | undefined {
  const x = sideOf(a)
  const y = sideOf(b)
  if (x === undefined || y === undefined) return undefined
  if (x === 'all' && y === 'all') return 'both-pass'
  if (x === 'none' && y === 'none') return 'both-fail'
  if ((x === 'all' && y === 'none') || (x === 'none' && y === 'all')) return 'discriminates'
  return 'mixed'
}

type PairCell = { key: string; role: string; harness: string; sandbox: string }

/**
 * Each unordered pair of cells on one harness and sandbox, when it has at least two variants
 * (with one, the only pair is the variant against its control, which the cell already has).
 * The control comes first, so a pair is `[later, earlier]`: every variant against the control,
 * then each variant against those before it.
 */
export function contrastPairs<T extends PairCell>(cells: T[]): Array<[T, T]> {
  const groups = new Map<string, T[]>()
  for (const c of cells) {
    const id = `${c.harness}\0${c.sandbox}`
    groups.set(id, [...(groups.get(id) ?? []), c])
  }
  const pairs: Array<[T, T]> = []
  for (const group of groups.values()) {
    const arms = [
      ...group.filter((c) => c.role === 'control'),
      ...group.filter((c) => c.role !== 'control'),
    ]
    if (arms.filter((c) => c.role === 'variant').length < 2) continue
    for (let j = 1; j < arms.length; j++) {
      for (let i = 0; i < j; i++) pairs.push([arms[j] as T, arms[i] as T])
    }
  }
  return pairs
}

export type ContrastCheck = { label: string; a: CheckTally; b: CheckTally; verdict: CheckVerdict }

/** Cell `a` against cell `b`: pass@1 lift (`vs` is `b`), effort and each shared check. */
export type Contrast = {
  a: string
  b: string
  lift: Lift | null
  effort: EffortContrast | null
  checks: ContrastCheck[]
  /** Unweighted cross-task point difference (`a` minus `b`) when more than 1 task ran. */
  taskPoints?: number
  /** Tasks where cell `a` scored 0% on multi-task evaluations; omitted when none or single-task. */
  brokenTasks?: string[]
}

const tally = ({ pass, fail, error, notRun, notApplicable = 0 }: CheckTally): CheckTally => ({
  pass,
  fail,
  error,
  notRun,
  notApplicable,
})

type ContrastEval = Pick<EvalEntry, 'cells' | 'attempts'> & { cases?: EvalEntry['cases'] }

function contrastTasks(
  e: ContrastEval,
): Array<{ id: string; label: string; match: (a: AttemptRecord) => boolean }> {
  const caseKeys = [
    ...(e.cases ?? []).map((c) => c.key),
    ...e.attempts.flatMap((a) => (a.case !== undefined ? [a.case] : [])),
  ]
  const uniqueCases = [...new Set(caseKeys)]
  if (uniqueCases.length > 0) {
    return uniqueCases.map((key) => ({
      id: key,
      label: key,
      match: (a) => a.case === key,
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
  if (!multiPromptInCell || allPrompts.length <= 1) return []
  return allPrompts.map((prompt, idx) => {
    const oneLine = prompt.replace(/\s+/g, ' ').trim()
    const short = oneLine.length > 60 ? `${oneLine.slice(0, 59)}…` : oneLine
    return {
      id: `prompt-${idx + 1}`,
      label: short,
      match: (a) => a.turns[0]?.prompt?.trim() === prompt,
    }
  })
}

function pairLift(
  e: ContrastEval,
  a: CellRecord,
  b: CellRecord,
  tasks: ReturnType<typeof contrastTasks>,
): { lift: Lift | null; taskPoints?: number; brokenTasks?: string[] } {
  if (a.passRate === null || b.passRate === null) return { lift: null }
  const variant = { pass: a.pass, counted: a.pass + a.fail }
  const control = { pass: b.pass, counted: b.pass + b.fail }
  const { points, low, high } = liftInterval(
    { pass: variant.pass, n: variant.counted },
    { pass: control.pass, n: control.counted },
  )
  const lift: Lift = {
    vs: b.key,
    control,
    variant,
    points: round3(points),
    interval: { lo: round3(low), hi: round3(high), level: 0.95, method: 'newcombe-wilson' },
    withinNoise: containsZero(low, high),
  }
  if (tasks.length > 1) {
    const forCell = (cellKey: string) =>
      tasks.map((t) => {
        const caseCell = e.cases?.find((c) => c.key === t.id)?.cells.find((c) => c.key === cellKey)
        if (caseCell) {
          return { label: t.label, pass: caseCell.pass, n: caseCell.pass + caseCell.fail }
        }
        const pool = e.attempts.filter(
          (att) =>
            att.cell === cellKey &&
            (att.outcome === 'pass' || att.outcome === 'fail') &&
            t.match(att),
        )
        const pass = pool.filter((att) => att.outcome === 'pass').length
        return { label: t.label, pass, n: pool.length }
      })
    const aTasks = forCell(a.key)
    const bTasks = forCell(b.key)
    const aMean = taskMeanRate(aTasks)
    const bMean = taskMeanRate(bTasks)
    const broken = aTasks.filter((t) => t.n > 0 && t.pass === 0).map((t) => t.label)
    return {
      lift,
      ...(aMean !== null && bMean !== null ? { taskPoints: round3(aMean - bMean) } : {}),
      ...(broken.length ? { brokenTasks: broken } : {}),
    }
  }
  return { lift }
}

/** An eval's contrasts: one per pair `contrastPairs` gives; empty with fewer than two variants. */
export function contrastsOf(e: ContrastEval): Contrast[] {
  const tasks = contrastTasks(e)
  return contrastPairs(e.cells).map(([a, b]) => {
    const { lift, taskPoints, brokenTasks } = pairLift(e, a, b, tasks)
    return {
      a: a.key,
      b: b.key,
      lift,
      effort: contrastEffort(cellSamples(e, a.key), cellSamples(e, b.key)),
      checks: (a.checks ?? []).flatMap((k) => {
        const other = b.checks?.find((x) => x.label === k.label)
        const verdict = other && checkVerdict(k, other)
        return other && verdict ? [{ label: k.label, a: tally(k), b: tally(other), verdict }] : []
      }),
      ...(taskPoints !== undefined ? { taskPoints } : {}),
      ...(brokenTasks ? { brokenTasks } : {}),
    }
  })
}
