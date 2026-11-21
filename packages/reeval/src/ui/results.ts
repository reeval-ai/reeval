// The results a finished run prints: its presentation's brief sections (all of them under -v) from
// `reeval/renderer/ascii`, the same sections summary.md and the studio show, then the pointer. Its
// remarks are the ones `shownRemarks` lets this run print, so a remark prints once and the cap
// holds the rest back for -v.
import type { RunRecord } from '../history/types.ts'
import { runReportText } from '../renderer/ascii.ts'
import type { Verdict } from '../view/present/index.ts'
import { present } from '../view/present/index.ts'
import type { RunRemarks } from '../view/remarks.ts'
import { buildRunReport } from '../view/report/index.ts'
import type { Colors } from './colors.ts'
import { shownRemarks } from './remarks.ts'

export function resultLines(
  record: RunRecord,
  c: Colors,
  options: {
    remarks?: RunRemarks | null
    verbose: boolean
    width?: number
    pointer: string
    /** Attempts the run planned that this resume's filters left out. */
    notRun?: number
  },
): string[] {
  const { shown, hidden } = shownRemarks(
    options.remarks?.remarks ?? [],
    record.runId,
    options.verbose,
  )
  const remarks = options.remarks ? { ...options.remarks, remarks: shown } : null
  const p = present(buildRunReport(record, { remarks }))
  const paint: Record<Verdict, (t: string) => string> = {
    pass: c.green,
    fail: c.red,
    ungated: c.dim,
    'infra-error': c.yellow,
    canceled: c.yellow,
    skipped: c.dim,
    todo: c.dim,
    'not-run': c.dim,
  }
  const text = runReportText(p, {
    detail: options.verbose ? 'verbose' : 'brief',
    ...(options.width ? { width: options.width } : {}),
    style: { verdict: (v, t) => paint[v](t), dim: c.dim, bold: c.bold },
  })
  return [
    ...text.trimEnd().split('\n'),
    ...(hidden ? ['', c.dim(`+${hidden} more remark${hidden === 1 ? '' : 's'} (-v)`)] : []),
    ...(options.notRun ? ['', c.yellow(incomplete(record.runId, options.notRun))] : []),
    '',
    options.pointer,
  ]
}

const incomplete = (runId: string, n: number) =>
  `Incomplete: ${n === 1 ? '1 attempt' : `${n} attempts`} this resume’s filters left out ${n === 1 ? 'is' : 'are'} not run; reeval run --resume ${runId} runs ${n === 1 ? 'it' : 'them'}`
