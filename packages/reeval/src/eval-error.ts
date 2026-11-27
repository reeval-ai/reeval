import { notJson } from './trial/observe.ts'
import type { JSONValue } from './types.ts'

/** `new EvalError({ … })`: why the task stopped, the facts that show it, and what caused it. */
export type EvalErrorOptions = {
  /** One line on why the task stopped, such as `the build fails`. */
  reason: string
  /** A few facts a reader needs to see why, such as `{ exitCode: 1 }`: a JSON object. */
  meta?: { [key: string]: JSONValue }
  /** The error that led to it, as `Error`'s `cause`. */
  cause?: unknown
}

/**
 * Thrown by an eval's task to stop the trial before it's graded: the trial didn't get far
 * enough. It fails the trial as any error the task throws does, and reads back better: its
 * `reason` is the trial's headline and its `meta` is recorded beside it.
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: reeval's EvalError stands in for the global one
export class EvalError extends Error {
  override name = 'EvalError'
  readonly reason: string
  readonly meta?: { [key: string]: JSONValue }

  constructor(reason: string | EvalErrorOptions) {
    const options = typeof reason === 'string' ? { reason } : reason
    if (typeof options?.reason !== 'string' || !options.reason.trim()) {
      throw new TypeError('EvalError takes a reason: new EvalError("the build fails")')
    }
    super(options.reason, 'cause' in options ? { cause: options.cause } : undefined)
    this.reason = options.reason
    if (options.meta !== undefined) {
      const { meta } = options
      if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
        throw new TypeError('EvalError meta takes a JSON object, such as { exitCode: 1 }')
      }
      const problem = notJson(meta)
      if (problem) throw new TypeError(`EvalError meta takes JSON: ${problem}`)
      this.meta = meta
    }
  }
}

/**
 * An `EvalError` from this copy of reeval or another, by its name and `reason`: JavaScript's own
 * global `EvalError`, which a file that doesn't import reeval's gets, has no `reason`.
 */
export const isEvalError = (error: unknown): error is EvalError =>
  error instanceof EvalError ||
  (error instanceof Error &&
    error.name === 'EvalError' &&
    typeof (error as EvalError).reason === 'string')
