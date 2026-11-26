import type { AttemptRecord, ExportFormat, RunRecord } from './history/types.ts'
import { toAtif } from './view/atif.ts'
import type { TrajectoryLine } from './view/model.ts'

type Exporter = {
  /** The file each attempt's export is, in the attempt's folder. */
  file: string
  render(run: RunRecord, attempt: AttemptRecord, lines: TrajectoryLine[]): string
}

export const EXPORTERS: Record<ExportFormat, Exporter> = {
  atif: {
    file: 'atif.json',
    render: (run, attempt, lines) => `${JSON.stringify(toAtif(run, attempt, lines), null, 2)}\n`,
  },
}
