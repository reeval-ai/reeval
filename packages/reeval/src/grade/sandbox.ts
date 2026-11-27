// A grader's `env`: a fresh sandbox from the image preflight prepared, in a slot of the run's
// concurrency, torn down once its grade returns.
import { getRunContext } from '../engine/runtime.ts'
import { canonicalJson } from '../eval-source.ts'
import { relativeFile, sha256 } from '../ids.ts'
import { sandboxProvider } from '../options.ts'
import { createSandbox } from '../sandbox/index.ts'
import { providerLimit, sandboxKind } from '../sandbox/kinds.ts'
import { InfraError, type Sandbox } from '../sandbox/types.ts'
import { acquire, type Lease } from '../scheduler/client.ts'
import type { Limits } from '../scheduler/core.ts'
import type { HarnessDescriptor, SandboxDescriptor } from '../types.ts'
import type { GradeRun, GraderEnv } from './define.ts'

/** The harness a grader's image is prepared for: no agent runs in it, so every grader shares one. */
export const GRADER_HARNESS: HarnessDescriptor = { kind: 'fake' }

/** A grader's sandbox while its grade runs, and its fingerprint's `image` part. */
export type StartedSandbox = { box: Sandbox; image: string; close(): Promise<void> }

/**
 * Starts a grader's `env` sandbox for one grade call that may take `timeoutMs`: `signal` while it
 * waits for a slot, then `held()`'s, which also counts the grader's timeout, once the slot is held.
 */
export type SandboxStarter = (
  env: GraderEnv,
  timeoutMs: number,
  signal: AbortSignal,
  held: () => AbortSignal,
) => Promise<StartedSandbox>

/** The starter for the graders of `trial`, on `trialSandbox`, in this run. */
export function sandboxStarter(trial: string, trialSandbox: SandboxDescriptor): SandboxStarter {
  const { runId, config, concurrency } = getRunContext()
  const slot = graderSlots(concurrency, trialSandbox)
  return async (env, timeoutMs, waiting, held) => {
    const lease = await slot(env.sandbox, waiting)
    const signal = held()
    try {
      const image = await graderImage(config.root, runId, env.sandbox)
      const box = await createSandbox(env.sandbox, {
        runId,
        trial,
        timeoutMs: timeoutMs + 60_000,
        signal,
        env: {},
        ...(image && { image: image.ref }),
        egress: env.egress,
      })
      return {
        box,
        image: imagePart(env, config.root, image?.id),
        async close() {
          try {
            await box.destroy()
          } finally {
            lease.release()
          }
        },
      }
    } catch (error) {
      lease.release()
      throw error
    }
  }
}

/**
 * Looks up the image of each grader's sandbox in `runs`, so one that failed to prepare fails the
 * trial before its agent starts.
 */
export async function checkGraderImages(runs: readonly GradeRun[]): Promise<void> {
  const { runId, config } = getRunContext()
  for (const run of new Set(runs)) {
    if (run.kind === 'code' && run.env) await graderImage(config.root, runId, run.env.sandbox)
  }
}

/** The image preflight prepared for a grader's `sandbox` in run `runId`; undefined without images. */
export async function graderImage(root: string, runId: string, sandbox: SandboxDescriptor) {
  const kind = sandboxKind(sandbox)
  if (!kind.capabilities.images) return undefined
  const { preparedFor } = await import('../sandbox/preflight.ts')
  const { trialImage, createProviders } = await import('../sandbox/providers.ts')
  // Preflight prepared it with the trial's own image.
  const provider = createProviders()[kind.provider(sandbox)]
  const prepared = provider && preparedFor(root, runId, provider, sandbox, GRADER_HARNESS)
  if (!prepared) {
    throw new InfraError("A grader's sandbox image wasn't prepared before the run started")
  }
  return trialImage(prepared)
}

/**
 * Slots for the grader sandboxes of a trial on `trialSandbox`. On the trial's provider, the
 * first takes the slot of the trial's own sandbox, gone by now while its lease holds until the
 * trial ends, and another waits for that slot or a new lease on the run's concurrency, whichever
 * comes first. On another provider, each leases only that provider's limit: the run's concurrency
 * is the trials', which a grader waiting on it while its trial holds one could deadlock.
 */
export function graderSlots(
  concurrency: number,
  trialSandbox: SandboxDescriptor,
): (sandbox: SandboxDescriptor, signal: AbortSignal) => Promise<Lease> {
  let free = true
  const waiting: Array<() => void> = []
  const own = (): Lease => {
    let released = false
    return {
      release() {
        if (released) return
        released = true
        const next = waiting.shift()
        if (next) next()
        else free = true
      },
    }
  }
  return async (sandbox, signal) => {
    signal.throwIfAborted()
    const provider = sandboxProvider(sandbox)
    const cap = providerLimit(sandbox)
    if (provider !== sandboxProvider(trialSandbox)) {
      return cap ? acquire({ [`sandbox:${provider}`]: cap }, { signal }) : { release() {} }
    }
    if (free) {
      free = false
      return own()
    }
    const limits: Limits = { trials: concurrency }
    if (cap) limits[`sandbox:${provider}`] = cap
    let handed = false
    let wake = () => {}
    const freed = new Promise<undefined>((resolve) => {
      wake = () => {
        handed = true
        resolve(undefined)
      }
    })
    waiting.push(wake)
    const stop = new AbortController()
    const leased = acquire(limits, { signal: AbortSignal.any([signal, stop.signal]) })
    const giveBack = () => {
      if (handed) own().release()
      else waiting.splice(waiting.indexOf(wake), 1)
    }
    try {
      const won = await Promise.race([leased, freed])
      if (won) {
        giveBack()
        return won
      }
    } catch (error) {
      giveBack()
      throw error
    }
    stop.abort()
    leased.then(
      (lease) => lease.release(),
      () => {},
    )
    return own()
  }
}

/** The fingerprint's `image` part: the recipe as the project gives it, its egress, the image's id. */
export function imagePart(env: GraderEnv, root: string, imageId: string | undefined): string {
  const {
    dir: _,
    id: __,
    maxConcurrent: ___,
    ...recipe
  } = env.sandbox as SandboxDescriptor & {
    dir?: string
  }
  const dockerfile = (recipe as { dockerfile?: string }).dockerfile
  return sha256(
    canonicalJson({
      recipe: dockerfile ? { ...recipe, dockerfile: relativeFile(root, dockerfile) } : recipe,
      egress: env.egress.policy,
      ...(imageId ? { image: imageId } : {}),
    }),
  )
}
