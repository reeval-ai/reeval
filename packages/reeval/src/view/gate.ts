// A cell's gate as compare and the history read it: its label, its fingerprint part, and the
// outcome its trials give under it. Browser-safe, so the studio re-scores a run as the CLI does.
import type {
  TrialRecord,
  CellRecord,
  FingerprintParts,
  HistoryCell,
  ScoreSummary,
} from '../history/types.ts'
import type { CellGate, Outcome } from '../types.ts'

/** `all`, `any`, `none` or `passRate 0.5`; `{ passRate: 1 }` is `all`, which scores the same. */
export const gateLabel = (gate: CellGate) =>
  typeof gate === 'string' ? gate : gate.passRate === 1 ? 'all' : `passRate ${gate.passRate}`

/** The gate's part of a fingerprint: none on `'all'`, so such a cell keeps its fingerprint. */
export const gatePart = (gate: CellGate): Pick<FingerprintParts, 'gate'> => {
  const label = gateLabel(gate)
  return label === 'all' ? {} : { gate: label }
}

/** Any failure fails; then infra errors; then all-skipped; else pass. */
export function worstOutcome(outcomes: Outcome[]): Outcome {
  if (outcomes.includes('fail')) return 'fail'
  if (outcomes.includes('infra_error')) return 'infra_error'
  if (outcomes.length > 0 && outcomes.every((o) => o === 'skipped')) return 'skipped'
  return outcomes.length ? 'pass' : 'skipped'
}

/** How the counted trials scored; a trial without a score counts 1 for a pass, 0 for a fail. */
export function scoresOf(trials: ReadonlyArray<Pick<TrialRecord, 'outcome' | 'score'>>) {
  const counted = trials.filter((a) => a.outcome === 'pass' || a.outcome === 'fail')
  if (!counted.length) return { meanScore: null, passAtK: null, passHatK: null }
  const sum = counted.reduce((s, a) => s + (a.score ?? (a.outcome === 'pass' ? 1 : 0)), 0)
  return {
    meanScore: sum / counted.length,
    passAtK: counted.some((a) => a.outcome === 'pass') ? 1 : 0,
    passHatK: counted.every((a) => a.outcome === 'pass') ? 1 : 0,
  } satisfies ScoreSummary
}

/** Each measure's mean over the summaries that have it; null where none does. */
export function meanScores(summaries: ReadonlyArray<ScoreSummary | undefined>): ScoreSummary {
  const mean = (key: keyof ScoreSummary) => {
    const xs = summaries.flatMap((s) => (s?.[key] == null ? [] : [s[key] as number]))
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
  }
  return { meanScore: mean('meanScore'), passAtK: mean('passAtK'), passHatK: mean('passHatK') }
}

/** The cells an eval's target applies to: the variants on a compare, else every cell. */
export const targetCells = <C extends Pick<CellRecord, 'role'>>(cells: readonly C[]): C[] =>
  cells.some((c) => c.role === 'variant') ? cells.filter((c) => c.role === 'variant') : [...cells]

export const passRateOf = (outcomes: Outcome[]) => {
  const pass = outcomes.filter((o) => o === 'pass').length
  const counted = pass + outcomes.filter((o) => o === 'fail').length
  return counted ? pass / counted : null
}

/**
 * A cell's outcome by its gate. `'all'` needs every counted trial to pass, `'any'` one, and
 * `{ passRate }` the mean score (the pass share without one, as in a `bestOf` cell) to reach it;
 * it is an infra error only when nothing counted. `'none'` takes the worst trial.
 */
export function cellOutcome(
  outcomes: Outcome[],
  gate: CellGate,
  meanScore?: number | null,
): Outcome {
  if (gate === 'none') return worstOutcome(outcomes)
  const rate = passRateOf(outcomes)
  if (rate === null) return worstOutcome(outcomes)
  if (gate === 'all') return rate === 1 ? 'pass' : 'fail'
  if (gate === 'any') return rate > 0 ? 'pass' : 'fail'
  return (meanScore ?? rate) >= gate.passRate ? 'pass' : 'fail'
}

type Tallied = Pick<
  HistoryCell,
  'gate' | 'outcome' | 'pass' | 'fail' | 'infraError' | 'skipped' | 'canceled' | 'scores' | 'bestOf'
>

/** The cell's trials, less the fails the run's interrupt canceled, which the agent didn't fail. */
const outcomesOf = (c: Tallied): Outcome[] => [
  ...Array<Outcome>(c.pass).fill('pass'),
  ...Array<Outcome>(c.fail - (c.canceled ?? 0)).fill('fail'),
  ...Array<Outcome>(c.infraError).fill('infra_error'),
  ...Array<Outcome>(c.skipped).fill('skipped'),
]

/** The cell's mean score less its canceled fails, which score 0 and `outcomesOf` drops. */
function meanUncanceled(c: Tallied): number | null | undefined {
  const mean = c.scores?.meanScore
  const counted = c.pass + c.fail
  const canceled = c.canceled ?? 0
  if (mean == null || !canceled) return mean
  return counted > canceled ? (mean * counted) / (counted - canceled) : null
}

/**
 * A cell's recorded trials scored under another gate. A cell its own gate passes but that
 * failed anyway fell short of its `minLift`, which no gate changes, so it still fails.
 */
export function rescore(c: Tallied, gate: CellGate): Outcome {
  const outcomes = outcomesOf(c)
  const mean = c.bestOf === undefined ? meanUncanceled(c) : undefined
  const liftFailed = c.outcome === 'fail' && cellOutcome(outcomes, c.gate, mean) === 'pass'
  return liftFailed ? 'fail' : cellOutcome(outcomes, gate, mean)
}
