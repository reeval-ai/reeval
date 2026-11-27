// What `evaluate`, `group` and a trial use of the engine, whichever engine runs the file:
// the worker's engine installs itself here before it loads an eval file.
import { UsageError } from '../errors.ts'
import type { Limits, Rank } from '../scheduler/core.ts'
import type { TrialMeta, EvalMeta, RunContext } from '../types.ts'
import type { Progress } from '../ui/events.ts'
import type { DebugLine } from '../view/debug.ts'

export type TestHandle = {
  file: string
  signal: AbortSignal
  setMeta(meta: EvalMeta): void
  /** Streams a progress event to the main process as it happens. Never throws. */
  progress(progress: Progress): void
  /** Streams a debug line to the main process (for `-v`). Never throws. */
  debug(line: DebugLine): void
}

export type TestMode = 'run' | 'skip' | 'only' | 'todo'

/** What a trial needs before it starts: leases on these resources, in this place in line. */
export type Gate = { limits: Limits; rank: Rank }

export type TestOptions = {
  /** The trial's own timeout, from its lease; none for placeholders. */
  timeout?: number
  mode: TestMode
  trial?: TrialMeta
  /** The leases the trial waits for when it's ready to start; none for placeholders. */
  gate?: Gate
  /**
   * Awaited before the trial asks for its leases: `false` skips it unrun. A best-of cell's
   * later trials wait here for the earlier ones, so they hold no lease while they wait.
   */
  ready?: () => Promise<boolean>
  /** Called once the test is done with, run or not: after its body settles, when it had one. */
  settled?: (settled: Settled) => void
}

/** How a test ended, for `settled`: its state, and the meta its body set last. */
export type Settled = { state: 'passed' | 'failed' | 'skipped'; meta?: EvalMeta }

export type Engine = {
  registerTest(
    name: string,
    options: TestOptions,
    body: (handle: TestHandle) => Promise<void>,
  ): void
  registerGroup(name: string, mode: TestMode, body: () => void): void
  getRunContext(): RunContext
  /** The eval file being collected, while its evals are declared. */
  collectingFile(): string | undefined
  /**
   * The harness ids a declared eval runs on before a profile's limit, tags or not, and the trait
   * keys its baseline environments define, when the tags select it.
   */
  declarePlanned(harnesses: readonly string[], traits: readonly string[]): void
}

let engine: Engine | undefined

/** Installs the engine this worker runs eval files with. */
export function useEngine(next: Engine): void {
  engine = next
}

function active(): Engine {
  if (!engine)
    throw new UsageError(
      'Evals only load in an eval file that reeval run loads. Run it with reeval run.',
    )
  return engine
}

export const registerTest: Engine['registerTest'] = (name, options, body) =>
  active().registerTest(name, options, body)

export const registerGroup: Engine['registerGroup'] = (name, mode, body) =>
  active().registerGroup(name, mode, body)

export const getRunContext = (): RunContext => active().getRunContext()

export const collectingFile = (): string | undefined => active().collectingFile()

export const declarePlanned: Engine['declarePlanned'] = (harnesses, traits) =>
  active().declarePlanned(harnesses, traits)
