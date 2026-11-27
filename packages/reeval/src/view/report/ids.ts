import type { EvalEntry, RunRecord } from '../../history/types.ts'
import { sha256Hex } from '../../sha256.ts'
import { slugify } from '../../slug.ts'

export type TrialIdMap = ReadonlyMap<string, string>

/**
 * Stable short IDs `A1..AN` for every trial that started (`seq !== null`),
 * ordered by `seq` across the (optionally filtered) evals. Every block cites
 * through this map.
 */
export function trialIds(
  record: Pick<RunRecord, 'evals'>,
  evalKeys?: ReadonlySet<string>,
): TrialIdMap {
  const trials = record.evals
    .filter((e) => !evalKeys || evalKeys.has(e.key))
    .flatMap((e) => e.trials.map((a) => ({ eval: e, trial: a })))
    .filter((row) => row.trial.seq !== null)
    .sort((a, b) => (a.trial.seq as number) - (b.trial.seq as number))

  const map = new Map<string, string>()
  let n = 1
  for (const row of trials) {
    map.set(row.trial.key, `A${n++}`)
  }
  return map
}

/** The short ID for a trial key, or null when it never started. */
export function idOf(ids: TrialIdMap, trialKey: string): string | null {
  return ids.get(trialKey) ?? null
}

/**
 * The HTML id of a trial's row in the trial index, from its stable key, so a link to it holds
 * in any report of the run: `trial-` and a slug of the key, with a hash of the whole key that
 * keeps two keys whose slugs match apart.
 */
export function trialAnchorId(key: string): string {
  return `trial-${slugify(key, 60) || 'key'}-${sha256Hex(key).slice(0, 8)}`
}

/** Anchor fragment for a trial: `#` and its `trialAnchorId`. */
export function trialAnchor(key: string): string {
  return `#${trialAnchorId(key)}`
}

/** Eval entries in report order, optionally filtered by `options.evals`. */
export function selectedEvals(
  record: Pick<RunRecord, 'evals'>,
  keys?: readonly string[],
): EvalEntry[] {
  if (!keys || keys.length === 0) return [...record.evals]
  const want = new Set(keys)
  return record.evals.filter((e) => want.has(e.key))
}
