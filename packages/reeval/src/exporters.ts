import type { ExportFormat, RunRecord, TrialRecord } from './history/types.ts'
import { toAtif } from './view/atif.ts'
import type { TrajectoryLine } from './view/model.ts'

type Exporter = {
  /** The file each trial's export is, in the trial's folder. */
  file: string
  render(run: RunRecord, trial: TrialRecord, lines: TrajectoryLine[]): string
}

export const EXPORTERS: Record<ExportFormat, Exporter> = {
  atif: {
    file: 'atif.json',
    render: (run, trial, lines) => `${JSON.stringify(toAtif(run, trial, lines), null, 2)}\n`,
  },
}
