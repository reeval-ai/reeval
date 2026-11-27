// The run files `reeval mcp` reads beside the records: trajectories, setup and check logs.
import { readFile } from 'node:fs/promises'
import type { RunRecord, TrialRecord } from '../history/types.ts'
import { resolveFile, type StudioSource } from '../studio/source.ts'
import type { ResolvedConfig } from '../types.ts'
import type { TrajectoryLine } from '../view/model.ts'
import { readableTrajectoryLine } from '../view/record.ts'

export const source = (config: ResolvedConfig): StudioSource => ({
  root: config.root,
  historyDir: config.history.dir,
  scratch: true,
})

/** The trial `ref` names in `run`: its key, or a trial id (`<cell>#<n>`) unique in the run. */
export function findTrial(run: RunRecord, ref: string) {
  const trials = run.evals.flatMap((e) => e.trials)
  const exact = trials.find((a) => a.key === ref)
  if (exact) return exact
  const byId = trials.filter((a) => a.id === ref)
  if (byId.length === 1 && byId[0]) return byId[0]
  const keys = trials.map((a) => a.key)
  const listed = `${keys.slice(0, 20).join('; ')}${keys.length > 20 ? `; … ${keys.length - 20} more` : ''}`
  throw new Error(
    byId.length > 1
      ? `"${ref}" is a trial of ${byId.length} evals in ${run.runId}; use its key: ${byId.map((a) => a.key).join('; ')}`
      : `No trial "${ref}" in ${run.runId}. Trials: ${listed}`,
  )
}

/** The path of a file the run kept, or null when it wasn't kept. */
export async function runFile(config: ResolvedConfig, run: RunRecord, path: string | undefined) {
  if (!path) return null
  return resolveFile(source(config), {
    kind: 'artifact',
    runId: run.runId,
    segments: path.split('/'),
  })
}

/** The trial's trajectory lines, or null when the run kept no trajectory for it. */
export async function trajectoryLines(
  config: ResolvedConfig,
  run: RunRecord,
  trial: TrialRecord,
): Promise<TrajectoryLine[] | null> {
  const file = await runFile(config, run, trial.files.trajectory?.path)
  if (!file) return null
  const lines: TrajectoryLine[] = []
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    if (!line.trim()) continue
    try {
      lines.push(readableTrajectoryLine(JSON.parse(line) as TrajectoryLine))
    } catch {}
  }
  return lines
}

export async function readTrajectory(config: ResolvedConfig, run: RunRecord, ref: string) {
  const trial = findTrial(run, ref)
  const lines = await trajectoryLines(config, run, trial)
  if (!lines) {
    throw new Error(
      `${run.runId} kept no trajectory for ${trial.key} (recorded with --artifacts failures or none?)`,
    )
  }
  return { trial, lines }
}

/** The last `chars` characters of a kept file, from a line start; null when it wasn't kept. */
export async function fileTail(
  config: ResolvedConfig,
  run: RunRecord,
  path: string | undefined,
  chars: number,
): Promise<string | null> {
  const file = await runFile(config, run, path)
  if (!file) return null
  const text = (await readFile(file, 'utf8')).trimEnd()
  if (text.length <= chars) return text
  const cut = text.slice(-chars)
  const nl = cut.indexOf('\n')
  return `…${nl >= 0 && nl < cut.length - 1 ? cut.slice(nl + 1) : cut}`
}
