import type { TrialIndexRow, EvalSection, RunReport } from './types.ts'

/** The newest `reportVersion` this reeval writes and reads. */
export const REPORT_VERSION = 5 satisfies RunReport['reportVersion']

/** One eval as the report's index lists it: its section's heading and headline, not its blocks. */
export type EvalSummary = Pick<
  EvalSection,
  'id' | 'anchor' | 'name' | 'file' | 'shapes' | 'design' | 'headline'
> & {
  /** How many rows of the trial index are this eval's: its `EvalDetail.trials`. */
  trials: number
}

/**
 * A `RunReport` without its per-eval detail: every top-level block, and each eval's summary in
 * the report's order. A page draws the run from it, then fetches each eval's `EvalDetail` on demand.
 */
export type RunReportIndex = Omit<RunReport, 'evals' | 'trials'> & { evals: EvalSummary[] }

/** One eval's whole section of a `RunReport`, with the trial index's rows for that eval. */
export type EvalDetail = {
  reportVersion: RunReport['reportVersion']
  runId: string
  eval: EvalSection
  /** In the trial index's order. */
  trials: TrialIndexRow[]
}

export type SplitRunReport = { index: RunReportIndex; details: EvalDetail[] }

/** The trial index's order: by the number in each row's display id, `A1..AN`. */
const inIdOrder = (a: TrialIndexRow, b: TrialIndexRow) =>
  Number(a.id.slice(1)) - Number(b.id.slice(1))

/**
 * `report` as its index and one detail per eval, which `joinRunReport` puts back together exactly.
 * Each eval's `id` is its own, each trial index row names its eval (`TrialIndexRow.evalId`,
 * the section's `id`) and the rows are in their display ids' order, as `buildRunReport` writes
 * them; a report that isn't throws.
 */
export function splitRunReport(report: RunReport): SplitRunReport {
  const { evals, trials, ...top } = report
  const rows = new Map<string, TrialIndexRow[]>()
  for (const e of evals) {
    if (rows.has(e.id)) throw new Error(`Eval ${e.id} is in the report twice`)
    rows.set(e.id, [])
  }
  trials.forEach((row, i) => {
    const of = rows.get(row.evalId)
    if (!of) throw new Error(`Trial ${row.key} names eval ${row.evalId}, which the report lacks`)
    const prev = trials[i - 1]
    if (prev && inIdOrder(prev, row) >= 0)
      throw new Error(`Trial ${row.id} is out of the index's order`)
    of.push(row)
  })
  const details = evals.map(
    (e): EvalDetail => ({
      reportVersion: report.reportVersion,
      runId: report.runId,
      eval: e,
      trials: rows.get(e.id) ?? [],
    }),
  )
  const index: RunReportIndex = {
    ...top,
    evals: details.map(({ eval: e, trials }) => ({
      id: e.id,
      anchor: e.anchor,
      name: e.name,
      file: e.file,
      shapes: e.shapes,
      design: e.design,
      headline: e.headline,
      trials: trials.length,
    })),
  }
  return { index, details }
}

/** The `RunReport` that `splitRunReport` split into `index` and `details`, keys in its order. */
export function joinRunReport(index: RunReportIndex, details: readonly EvalDetail[]): RunReport {
  const byId = new Map(details.map((d) => [d.eval.id, d]))
  const detailOf = (id: string) => {
    const d = byId.get(id)
    if (!d) throw new Error(`No detail for eval ${id}`)
    return d
  }
  const { evals, actions, provenance, ...head } = index
  return {
    ...head,
    evals: evals.map((e) => detailOf(e.id).eval),
    actions,
    provenance,
    trials: evals.flatMap((e) => detailOf(e.id).trials).sort(inIdOrder),
  }
}
