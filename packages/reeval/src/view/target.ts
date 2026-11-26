// An eval against its target, as every surface words it: the CLI's result line and the run
// report's headline say the same thing.

import { plural } from '../text.ts'
import { scorePercent as percent } from './report/format.ts'
import type { EvalResult, ScoredAttempt } from './suite.ts'

const counts = (a: ScoredAttempt) => a.score !== null

/**
 * What the eval is judged on against its target: `86% ≥ 80%` (or `86%` for `metric()`), `4/5 runs
 * at 100%, worst 70%` (the worst only over several runs), `every run ≥ 70%, worst 70%`, `2/5
 * runs at 100% (pass@5)`, or with cases `2/3 cases hit 100% (pass@2)`, as the record judges a
 * capability case by case (`(best of 3)` where a majority decides), then any infra errors; its
 * outcome in words when no attempt counted.
 */
export function targetNumber(e: EvalResult): string {
  if (e.todo) return 'todo'
  if (e.notRun) return 'not run'
  const runs = e.scored.filter(counts)
  if (!runs.length) {
    return e.outcome === 'infra_error'
      ? 'infra error'
      : e.outcome === 'canceled'
        ? 'canceled'
        : 'skipped'
  }
  const infra = e.scored.filter((a) => a.outcome === 'infra_error').length
  const more = infra ? ` · ${plural(infra, 'infra error')}` : ''
  const t = e.target
  if (t.kind === 'metric') {
    const mean = e.meanScore ?? runs.reduce((s, a) => s + (a.score ?? 0), 0) / runs.length
    if (t.threshold === undefined) return `${percent(mean)}${more}`
    const shown = percent(mean, t.threshold)
    return `${shown} ${mean >= t.threshold ? '≥' : '<'} ${percent(t.threshold)}${more}`
  }
  const hits = runs.filter((a) => a.outcome === 'pass').length
  const at = t.threshold === 1 ? 'at 100%' : `≥ ${percent(t.threshold)}`
  const of = `${hits}/${plural(runs.length, 'run')} ${at}`
  const bestOf = (e.cells ?? e.cases?.flatMap((k) => k.cells) ?? []).find((c) => c.bestOf)?.bestOf
  if (bestOf) return `${of} (best of ${bestOf})${more}`
  if (t.kind === 'capability' && runs.some((a) => a.case !== null)) {
    const cases = new Map<string, ScoredAttempt[]>()
    for (const a of runs) {
      const key = `${a.case}\0${a.cell}`
      cases.set(key, [...(cases.get(key) ?? []), a])
    }
    const groups = [...cases.values()]
    const hit = groups.filter((g) => g.some((a) => a.outcome === 'pass')).length
    const k = Math.max(...groups.map((g) => g.length))
    const bar = t.threshold === 1 ? '100%' : `≥ ${percent(t.threshold)}`
    return `${hit}/${plural(groups.length, 'case')} hit ${bar} (pass@${k})${more}`
  }
  if (t.kind === 'capability') return `${of} (pass@${runs.length})${more}`
  const worst = Math.min(...runs.map((a) => a.score ?? 0))
  const head = hits === runs.length && t.threshold < 1 ? `every run ${at}` : of
  return `${head}${worst < 1 && runs.length > 1 ? `, worst ${percent(worst, t.threshold)}` : ''}${more}`
}

/** How the eval stands: `pass` and `fail` only for a blocking target, `report` otherwise. */
export function standing(e: EvalResult): 'pass' | 'fail' | 'report' | 'infra' | 'skipped' {
  if (e.todo || e.notRun || e.outcome === 'skipped' || e.outcome === 'canceled') return 'skipped'
  if (!e.scored.some(counts) && e.outcome === 'infra_error') return 'infra'
  if (!e.blocking) return 'report'
  return e.outcome === 'pass' ? 'pass' : e.outcome === 'fail' ? 'fail' : 'infra'
}
