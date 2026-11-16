// A recipe's image in a machine's own Docker, prepared there as `docker()` prepares one locally:
// reeval's image for the harness pulled by the digest this reeval pins, `image` pulled, or `from`,
// a Dockerfile or `install` built on the machine. A reused machine has it already.
import { docker, imageInfo, type RemoteEngine } from '@reeval/sandbox-docker'
import { attemptDebug } from '../debug/attempt.ts'
import type { DockerSandboxDescriptor } from '../types.ts'
import type { SandboxOptions } from './index.ts'
import { createBuilds, imageHarness, prepareImage } from './prepare.ts'
import type { ImageRecipe } from './recipe.ts'
import { InfraError } from './types.ts'

/** The ref of `recipe`'s image in `engine`'s Docker, pulled or built there when it's missing. */
export async function imageOnMachine(
  recipe: ImageRecipe,
  options: Pick<SandboxOptions, 'harness'>,
  engine: RemoteEngine,
  signal: AbortSignal,
): Promise<string> {
  const { harness } = options
  if (!harness) throw new InfraError(`An image recipe on ${engine.description} needs the harness`)
  const debug = attemptDebug()
  const log = (line: string) => debug?.log('container', line)
  const started = Date.now()
  try {
    const { image } = recipe
    if (image && !(await imageInfo(image, engine))) {
      const r = await docker(['pull', image], { engine, signal })
      if (r.exitCode !== 0) {
        throw new Error(`pulling ${image}: ${r.stderr.trim().split('\n').at(-1) ?? r.exitCode}`)
      }
    }
    const prepared = await prepareImage(
      { kind: 'docker', ...recipe } as DockerSandboxDescriptor,
      imageHarness(harness),
      process.cwd(),
      signal,
      createBuilds({ engine, log }),
    )
    const ms = Date.now() - started
    if (ms >= 1000) log(`${prepared.ref} ready in its Docker after ${Math.round(ms / 1000)}s`)
    return prepared.ref
  } catch (error) {
    if (signal.aborted) throw signal.reason
    throw new InfraError(
      `${engine.description} couldn't prepare the sandbox image: ${(error as Error).message}`,
    )
  }
}
