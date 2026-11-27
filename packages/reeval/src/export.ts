// `reeval export`: a run as its archive zip, or each trial in an exporter's format.
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { CommandError, pick } from './commands.ts'
import { EXPORTERS } from './exporters.ts'
import { exportRunArchive, readRecord, recordFile, scratchDir } from './history/files.ts'
import type { ExportFormat } from './history/types.ts'
import { fromCwd } from './ids.ts'
import { trajectoryLines } from './mcp/files.ts'
import type { ResolvedConfig } from './types.ts'

type Ctx = {
  config: ResolvedConfig
  flags: { format?: string; out?: string }
  out: (s: string) => void
}

export async function exportCommand(ctx: Ctx, refs: string[]): Promise<number> {
  const { config, flags } = ctx
  const format = flags.format
  const exporter =
    format === undefined || !Object.hasOwn(EXPORTERS, format)
      ? undefined
      : EXPORTERS[format as ExportFormat]
  if (format !== undefined && !exporter) {
    throw new CommandError(
      `reeval export has no format "${format}": use ${Object.keys(EXPORTERS).join(', ')}, or none for the run's archive`,
    )
  }
  const entry = await pick(config, refs[0])
  const { runId } = entry
  const dir = entry.recorded ? config.history.dir : scratchDir(config.root)
  if (!exporter) {
    const out = resolve(flags.out ?? `${runId}.zip`)
    const file = (await stat(out).catch(() => null))?.isDirectory()
      ? join(out, `${runId}.zip`)
      : out
    await mkdir(dirname(file), { recursive: true })
    await exportRunArchive(dir, runId, file)
    ctx.out(`Wrote ${fromCwd(file)}`)
    return 0
  }
  const run = await readRecord(recordFile(dir, runId))
  const out = resolve(flags.out ?? `${runId}.${format}`)
  let written = 0
  let skipped = 0
  for (const trial of run.evals.flatMap((e) => e.trials)) {
    const path = trial.files.trajectory?.path
    const lines = path ? await trajectoryLines(config, run, trial) : null
    if (!path || !lines) {
      if (trial.startedAt) skipped++
      continue
    }
    const file = join(out, dirname(path), exporter.file)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, exporter.render(run, trial, lines))
    written++
  }
  if (!written) {
    throw new CommandError(
      `${runId} kept no trajectory for any trial (recorded with --artifacts failures or none?)`,
    )
  }
  const note = skipped
    ? ` (${skipped} started ${skipped === 1 ? 'trial' : 'trials'} kept no trajectory)`
    : ''
  ctx.out(`Wrote ${written} ${exporter.file} to ${fromCwd(out)}${note}`)
  return 0
}
