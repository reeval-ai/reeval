// `reeval export`: a run as its archive zip, or each attempt in an exporter's format.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { writeArchive } from './archive/index.ts'
import { CommandError, pick } from './commands.ts'
import { readRecord, readRunArchiveFiles, recordFile, scratchDir } from './history/files.ts'
import type { AttemptRecord, RunRecord } from './history/types.ts'
import { fromCwd } from './ids.ts'
import { transcriptLines } from './mcp/files.ts'
import type { ResolvedConfig } from './types.ts'
import { toAtif } from './view/atif.ts'
import type { TranscriptLine } from './view/model.ts'

type Exporter = {
  /** The file each attempt's export is, in the attempt's folder. */
  file: string
  render(run: RunRecord, attempt: AttemptRecord, lines: TranscriptLine[]): string
}

export const EXPORTERS: Record<string, Exporter> = {
  atif: {
    file: 'atif.json',
    render: (run, attempt, lines) => `${JSON.stringify(toAtif(run, attempt, lines), null, 2)}\n`,
  },
}

type Ctx = {
  config: ResolvedConfig
  flags: { format?: string; out?: string }
  out: (s: string) => void
}

export async function exportCommand(ctx: Ctx, refs: string[]): Promise<number> {
  const { config, flags } = ctx
  const format = flags.format
  const exporter = format === undefined ? undefined : EXPORTERS[format]
  if (format !== undefined && !exporter) {
    throw new CommandError(
      `reeval export has no format "${format}": use ${Object.keys(EXPORTERS).join(', ')}, or none for the run's archive`,
    )
  }
  const entry = await pick(config, refs[0])
  const { runId } = entry
  const dir = entry.recorded ? config.history.dir : scratchDir(config.root)
  if (!exporter) {
    const file = resolve(flags.out ?? `${runId}.zip`)
    await mkdir(dirname(file), { recursive: true })
    await writeArchive(file, {
      contents: 'run',
      runId,
      files: await readRunArchiveFiles(dir, runId),
    })
    ctx.out(`Wrote ${fromCwd(file)}`)
    return 0
  }
  const run = await readRecord(recordFile(dir, runId))
  const out = resolve(flags.out ?? `${runId}.${format}`)
  let written = 0
  let skipped = 0
  for (const attempt of run.evals.flatMap((e) => e.attempts)) {
    const path = attempt.files.transcript?.path
    const lines = path ? await transcriptLines(config, run, attempt) : null
    if (!path || !lines) {
      if (attempt.startedAt) skipped++
      continue
    }
    const file = join(out, dirname(path), exporter.file)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, exporter.render(run, attempt, lines))
    written++
  }
  const note = skipped
    ? ` (${skipped} started ${skipped === 1 ? 'attempt' : 'attempts'} kept no transcript)`
    : ''
  ctx.out(`Wrote ${written} ${exporter.file} to ${fromCwd(out)}${note}`)
  return 0
}
