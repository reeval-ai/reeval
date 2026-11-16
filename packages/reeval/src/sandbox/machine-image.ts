// A recipe's image in a machine's own Docker, prepared there as `docker()` prepares one locally:
// reeval's image for the harness pulled by the digest this reeval pins, `image` pulled, or `from`,
// a Dockerfile or `install` built on the machine. A reused machine has it already.
import { setTimeout as sleep } from 'node:timers/promises'
import { docker, imageInfo, type RemoteEngine } from '@reeval/sandbox-docker'
import { attemptDebug } from '../debug/attempt.ts'
import type { AttemptImage, DockerSandboxDescriptor, HarnessDescriptor } from '../types.ts'
import { createBuilds, imageHarness, prepareImage } from './prepare.ts'
import { PrepareError } from './provider.ts'
import { classifyDocker } from './providers.ts'
import type { ImageRecipe } from './recipe.ts'
import { InfraError } from './types.ts'

/** Waits before each retry of a transient pull or build step. */
const RETRY_DELAYS_MS = [2_000, 8_000]

/** A recipe's config failure in this worker, so its other attempts fail without building again. */
const failed = new Map<string, PrepareError>()
/** Each machine's image per recipe in this worker, so its slots prepare it once between them. */
const prepared = new Map<string, Promise<AttemptImage>>()

/** The image as the record has it, ready in `engine`'s Docker on `machine`. */
export async function imageOnMachine(
  recipe: ImageRecipe,
  harness: HarnessDescriptor | undefined,
  machine: { id: string; description: string },
  engine: RemoteEngine,
  signal: AbortSignal,
): Promise<AttemptImage> {
  if (!harness) throw new InfraError(`An image recipe on ${machine.description} needs the harness`)
  const recipeKey = JSON.stringify([recipe, imageHarness(harness)])
  const key = `${machine.id}\0${recipeKey}`
  for (;;) {
    const known = failed.get(recipeKey)
    if (known) throw known
    let image = prepared.get(key)
    if (!image) {
      image = prepare(recipe, harness, machine.description, engine, signal)
      prepared.set(key, image)
      image.catch((error: unknown) => {
        prepared.delete(key)
        if (error instanceof PrepareError && error.failure.class === 'config') {
          failed.set(recipeKey, error)
        }
      })
    }
    try {
      return await image
    } catch (error) {
      if (signal.aborted) throw signal.reason
      if (error instanceof PrepareError) throw error
      // Another slot started it and was canceled: this one prepares it itself.
    }
  }
}

async function prepare(
  recipe: ImageRecipe,
  harness: HarnessDescriptor,
  where: string,
  engine: RemoteEngine,
  signal: AbortSignal,
): Promise<AttemptImage> {
  const debug = attemptDebug()
  const log = (line: string) => debug?.log('container', line)
  const retry = async <T>(step: () => Promise<T>): Promise<T> => {
    for (let i = 0; ; i++) {
      try {
        return await step()
      } catch (error) {
        if (signal.aborted || i >= RETRY_DELAYS_MS.length) throw error
        if (classifyDocker(error).class !== 'transient') throw error
        log(`retrying on ${where}: ${String((error as Error).message).split('\n')[0]}`)
        await sleep(RETRY_DELAYS_MS[i] ?? 0, undefined, { signal })
      }
    }
  }
  const started = Date.now()
  try {
    const { image } = recipe
    if (image && !(await imageInfo(image, engine))) {
      await retry(async () => {
        const r = await docker(['pull', image], { engine, signal })
        if (r.exitCode !== 0) {
          throw new Error(`pulling ${image}: ${r.stderr.trim().split('\n').at(-1) ?? r.exitCode}`)
        }
      })
    }
    const { plugins: _, ...ready } = await prepareImage(
      { kind: 'docker', ...recipe } as DockerSandboxDescriptor,
      imageHarness(harness),
      process.cwd(),
      signal,
      createBuilds({ engine, log, retry }),
    )
    const ms = Date.now() - started
    if (ms >= 1000) log(`${ready.ref} ready in its Docker after ${Math.round(ms / 1000)}s`)
    return ready
  } catch (error) {
    if (signal.aborted) throw signal.reason
    const failure = classifyDocker(error)
    throw new PrepareError({
      ...failure,
      message: `${where} couldn't prepare the sandbox image: ${failure.message}`,
    })
  }
}
