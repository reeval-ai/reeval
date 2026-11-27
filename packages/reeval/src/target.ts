// An eval's target as plain data, and what the plan and the history read from it. Browser-safe:
// the studio and the history derive a cell's gate as the plan does.
import type { CellGate, RecordedTarget, Target } from './types.ts'

/** Passes when every trial scores at least `threshold` (pass^k); a miss fails the run. */
export const regression = (threshold = 1): Target => ({ kind: 'regression', threshold })

/**
 * Passes when one trial scores at least `threshold` (pass@k). A miss fails the run only with
 * `blocking: true`. The default target is `capability()`.
 */
export const capability = (threshold = 1, options: { blocking?: boolean } = {}): Target => ({
  kind: 'capability',
  threshold,
  blocking: options.blocking ?? false,
})

/** The default: `capability()`, which only reports. */
export const DEFAULT_TARGET: Target = capability()

/** The score a trial passes at: the target's threshold, 1 without one. */
export const thresholdOf = (target: RecordedTarget | undefined): number => target?.threshold ?? 1

/** Whether a miss fails the run. */
export function blocks(target: RecordedTarget | undefined): boolean {
  if (!target) return false
  if (target.kind === 'metric') return target.threshold !== undefined
  return target.kind === 'regression' || target.blocking
}

/** `regression(0.8)`, `capability(1, { blocking: true })`: as the eval wrote it. */
export function targetLabel(target: RecordedTarget): string {
  if (target.kind === 'capability') {
    return `capability(${target.threshold}${target.blocking ? ', { blocking: true }' : ''})`
  }
  return `${target.kind}(${target.threshold ?? ''})`
}

/**
 * The gate of a cell the target applies to: a hit share in a `trials: { bestOf }` cell, else the
 * target's rule over the trials.
 */
export function targetGate(target: Target, bestOf: boolean): CellGate {
  if (bestOf) return { passRate: 0.5 }
  return target.kind === 'regression' ? 'all' : 'any'
}

/**
 * The target a record from before targets ran under, from its cells' gates: `'all'` is
 * `regression()`, `{ passRate }` is a mean-score `metric`, and none gated is a `metric` that only
 * reported.
 */
export function targetOfGates(gates: CellGate[]): RecordedTarget {
  const gate = gates.find((g) => g !== 'none')
  if (gate === undefined) return { kind: 'metric' }
  if (gate === 'all') return regression()
  if (gate === 'any') return capability(1, { blocking: true })
  return { kind: 'metric', threshold: gate.passRate }
}
