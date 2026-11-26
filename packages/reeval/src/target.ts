// An eval's target as plain data, and what the plan and the history read from it. Browser-safe:
// the studio and the history derive a cell's gate as the plan does.
import type { CellGate, Target } from './types.ts'

/**
 * Passes when the attempts' mean score reaches `threshold`; with none it only reports, never
 * failing the run. The default target.
 */
export const metric = (threshold?: number): Target =>
  threshold === undefined ? { kind: 'metric' } : { kind: 'metric', threshold }

/** Passes when every attempt scores at least `threshold` (pass^k); a miss fails the run. */
export const regression = (threshold = 1): Target => ({ kind: 'regression', threshold })

/**
 * Passes when one attempt scores at least `threshold` (pass@k). A miss fails the run only with
 * `blocking: true`.
 */
export const capability = (threshold = 1, options: { blocking?: boolean } = {}): Target => ({
  kind: 'capability',
  threshold,
  blocking: options.blocking ?? false,
})

/** The default: `metric()`. */
export const DEFAULT_TARGET: Target = { kind: 'metric' }

/** The score an attempt passes at: the target's threshold, 1 without one. */
export const thresholdOf = (target: Target | undefined): number => target?.threshold ?? 1

/** Whether a miss fails the run. */
export function blocks(target: Target | undefined): boolean {
  if (!target) return false
  if (target.kind === 'metric') return target.threshold !== undefined
  return target.kind === 'regression' || target.blocking
}

/** `metric()`, `regression(0.8)`, `capability(1, { blocking: true })`: as the eval wrote it. */
export function targetLabel(target: Target): string {
  if (target.kind === 'capability') {
    return `capability(${target.threshold}${target.blocking ? ', { blocking: true }' : ''})`
  }
  return `${target.kind}(${target.threshold ?? ''})`
}

/**
 * The gate of a cell the target applies to: `'none'` for a report-only `metric()`, a hit share
 * in a `runs: { bestOf }` cell, else the target's rule over the attempts.
 */
export function targetGate(target: Target, bestOf: boolean): CellGate {
  if (target.kind === 'metric' && target.threshold === undefined) return 'none'
  if (bestOf) return { passRate: 0.5 }
  if (target.kind === 'regression') return 'all'
  if (target.kind === 'capability') return 'any'
  return { passRate: target.threshold ?? 1 }
}

/**
 * The target a record from before targets ran under, from its cells' gates: `'all'` is
 * `regression()`, `{ passRate }` is `metric(passRate)`, and none gated is `metric()`.
 */
export function targetOfGates(gates: CellGate[]): Target {
  const gate = gates.find((g) => g !== 'none')
  if (gate === undefined) return DEFAULT_TARGET
  if (gate === 'all') return regression()
  if (gate === 'any') return capability(1, { blocking: true })
  return metric(gate.passRate)
}
