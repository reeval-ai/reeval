// An eval against its target, as every surface words it: the CLI's result line and the run
// report's headline say the same thing.

import { plural } from '../text.ts'
import type { Target } from '../types.ts'
import { scorePercent as percent } from './report/format.ts'
import type { EvalResult, ScoredTrial } from './suite.ts'

const counts = (a: ScoredTrial) => a.score !== null

/**
 * The mean score, then what the eval is judged on against its target: `mean 86% · 4/5 trials at
 * 100%, worst 70%` (the worst only over several trials), `mean 86% · every trial ≥ 70%, worst 70%`,
 * `mean 40% · 2/5 trials at 100% (pass@5)`, or with cases `mean 67% · 2/3 cases hit 100% (pass@2)`,
 * as the record judges a capability case by case (`(best of 3)` where a majority decides), then
 * any infra errors; an older record's `metric` reads `86% ≥ 80%`, or `86%` with no threshold. Its
 * outcome in words when no trial counted.
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
  const meanScore = e.meanScore ?? runs.reduce((s, a) => s + (a.score ?? 0), 0) / runs.length
  if (t.kind === 'metric') {
    if (t.threshold === undefined) return `${percent(meanScore)}${more}`
    const shown = percent(meanScore, t.threshold)
    return `${shown} ${meanScore >= t.threshold ? '≥' : '<'} ${percent(t.threshold)}${more}`
  }
  return `mean ${percent(meanScore, t.threshold)} · ${judgedOn(e, runs, t)}${more}`
}

function judgedOn(e: EvalResult, trials: ScoredTrial[], t: Target): string {
  const hits = trials.filter((a) => a.outcome === 'pass').length
  const at = t.threshold === 1 ? 'at 100%' : `≥ ${percent(t.threshold)}`
  const of = `${hits}/${plural(trials.length, 'trial')} ${at}`
  const bestOf = (e.cells ?? e.cases?.flatMap((k) => k.cells) ?? []).find((c) => c.bestOf)?.bestOf
  if (bestOf) return `${of} (best of ${bestOf})`
  if (t.kind === 'capability' && trials.some((a) => a.case !== null)) {
    const cases = new Map<string, ScoredTrial[]>()
    for (const a of trials) {
      const key = `${a.case}\0${a.cell}`
      cases.set(key, [...(cases.get(key) ?? []), a])
    }
    const groups = [...cases.values()]
    const hit = groups.filter((g) => g.some((a) => a.outcome === 'pass')).length
    const k = Math.max(...groups.map((g) => g.length))
    const bar = t.threshold === 1 ? '100%' : `≥ ${percent(t.threshold)}`
    return `${hit}/${plural(groups.length, 'case')} hit ${bar} (pass@${k})`
  }
  if (t.kind === 'capability') return `${of} (pass@${trials.length})`
  const worst = Math.min(...trials.map((a) => a.score ?? 0))
  const head = hits === trials.length && t.threshold < 1 ? `every trial ${at}` : of
  return `${head}${worst < 1 && trials.length > 1 ? `, worst ${percent(worst, t.threshold)}` : ''}`
}

/** How the eval stands: `pass` and `fail` only for a blocking target, `report` otherwise. */
export function standing(e: EvalResult): 'pass' | 'fail' | 'report' | 'infra' | 'skipped' {
  if (e.todo || e.notRun || e.outcome === 'skipped' || e.outcome === 'canceled') return 'skipped'
  if (!e.scored.some(counts) && e.outcome === 'infra_error') return 'infra'
  if (!e.blocking) return 'report'
  return e.outcome === 'pass' ? 'pass' : e.outcome === 'fail' ? 'fail' : 'infra'
}
