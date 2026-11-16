// An attempt on a pooled VM in a container of an image recipe's image, one that the saved snapshot
// the VM started from holds, or that the VM's Docker pulls or builds: the VM's docker CLI, over SSH,
// runs it as `docker()` runs one locally, so the egress gateway is its only way out and each
// attempt on a shared machine has a network of its own. A slot's reset is the next attempt's new
// container.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { docker, dockerCapacity, type RemoteEngine, sshArgv } from '@reeval/sandbox-docker'
import { run, unsetOtel } from '@reeval/sandbox-docker/process'
import { attemptDebug } from '../debug/attempt.ts'
import { registerSecret } from '../redact.ts'
import type {
  AttemptImage,
  BoatSandboxDescriptor,
  CloudSandboxDescriptor,
  SandboxBase,
} from '../types.ts'
import { containerSandbox } from './docker.ts'
import type { SandboxOptions } from './index.ts'
import { leaseMachine } from './machine-service.ts'
import { PrepareError } from './provider.ts'
import { type PooledSshMachine, TTL_MARGIN_S } from './ssh-pool.ts'
import { InfraError, type NetworkSandbox } from './types.ts'

/** How long a machine started from the snapshot may take to have the image ready in its Docker. */
const IMAGE_WAIT_MS = 4 * 60_000
const IMAGE_POLL_MS = 2_000
/** How many machines an attempt tries when a reused one's Docker doesn't answer. */
const SETUP_TRIES = 3

/** Where a machine's image comes from: the snapshot it starts from, and how its Docker gets it. */
export type VmImageSource = {
  snapshot?: string
  /**
   * Has the image in the machine's Docker and returns its ref, with the image as the record has it
   * when no preflight prepared it; a reused machine may have it already.
   */
  ready(
    engine: RemoteEngine,
    machine: PooledSshMachine,
    signal: AbortSignal,
  ): Promise<{ ref: string; image?: AttemptImage }>
}

/** The image `base`'s snapshot holds, which its machine's Docker has once it has booted. */
export const fromSnapshot = (base: SandboxBase): VmImageSource => ({
  snapshot: base.snapshot,
  async ready(engine, _machine, signal) {
    const waited = await untilImage(engine, base.image, signal)
    if (waited >= 1000) {
      attemptDebug()?.log(
        'container',
        `${base.image} ready in its Docker after ${Math.round(waited / 1000)}s`,
      )
    }
    return { ref: base.image }
  },
})

export type VmContainerOptions = {
  /** How messages name the sandbox: `boat`. */
  fn: string
  /** The record's provider: `boat`. */
  sandbox: string
  /** The size the record names when the descriptor sets none. */
  size: string
  /** How messages name one machine: `boat sandbox bx_… (small)`. */
  description(info: PooledSshMachine): string
}

/** Waits until `image` is in the machine's Docker, which starts as the machine boots. */
async function untilImage(
  engine: RemoteEngine,
  image: string,
  signal: AbortSignal,
  o: { waitMs?: number; pollMs?: number } = {},
): Promise<number> {
  const started = Date.now()
  const deadline = started + (o.waitMs ?? IMAGE_WAIT_MS)
  for (;;) {
    const r = await docker(['image', 'inspect', '--format', '{{.Id}}', image], {
      engine,
      signal,
    }).catch((error: unknown) => {
      if (signal.aborted) throw signal.reason
      return { exitCode: 1, stderr: (error as Error).message }
    })
    if (r.exitCode === 0) return Date.now() - started
    if (Date.now() > deadline) {
      throw new InfraError(
        `${engine.description} has no image ${image} from its snapshot after ${Math.round((o.waitMs ?? IMAGE_WAIT_MS) / 1000)}s: ${r.stderr.trim().split('\n').at(-1) || `exit ${r.exitCode}`}`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, o.pollMs ?? IMAGE_POLL_MS))
    signal.throwIfAborted()
  }
}

/** Closes the SSH connection the machine's commands shared. */
async function closeConnection(engine: RemoteEngine): Promise<void> {
  const [bin = 'ssh', ...args] = sshArgv(engine.target, '')
  await run(bin, ['-O', 'exit', ...args.slice(0, -1)], { env: unsetOtel() }).catch(() => {})
}

/**
 * One attempt in a container of `source`'s image on a slot of `descriptor`'s pool. A reused
 * machine whose Docker can't get the image is dropped and another leased, up to 3 times.
 */
export async function createVmContainerSandbox(
  descriptor: BoatSandboxDescriptor | CloudSandboxDescriptor,
  source: VmImageSource,
  options: SandboxOptions,
  o: VmContainerOptions,
): Promise<NetworkSandbox> {
  const debug = attemptDebug()
  for (let tries = 1; ; tries++) {
    const dir = await mkdtemp(join(tmpdir(), `reeval-${o.sandbox}-ssh-`))
    const lease = await leaseMachine(
      {
        sandbox: descriptor,
        runId: options.runId,
        ...(options.attempt !== undefined && { attempt: options.attempt }),
        root: process.cwd(),
        ttlSeconds: Math.ceil(options.timeoutMs / 1000) + TTL_MARGIN_S,
        ...(source.snapshot && { image: source.snapshot }),
      },
      options.signal,
    ).catch(async (error: unknown) => {
      await rm(dir, { recursive: true, force: true })
      if (options.signal.aborted) throw options.signal.reason
      throw error instanceof InfraError ? error : new InfraError((error as Error).message)
    })
    const info = lease.info as PooledSshMachine
    if (info.secretUser) registerSecret(info.user)
    debug?.log(
      'container',
      lease.start
        ? `created ${info.id} (${info.name}, ${info.size})${source.snapshot ? ` from snapshot ${source.snapshot}` : ''} in ${lease.start.ms}ms; slot ${lease.slot}`
        : `${lease.reused ? 'reused' : 'shared'} ${info.id} (${info.name}, ${info.size}); slot ${lease.slot}${lease.reused ? `, its attempt ${lease.reused + 1}` : ''}`,
    )
    const engine: RemoteEngine = {
      kind: 'ssh',
      target: {
        host: info.host,
        port: info.port,
        user: info.user,
        identityFile: info.identityFile,
        knownHostsFile: info.knownHostsFile,
        hostKeyAlias: info.id,
        controlPath: join(dir, 'cm'),
      },
      description: o.description(info),
    }
    const done = async (broken: boolean) => {
      await closeConnection(engine)
      await rm(dir, { recursive: true, force: true })
      await lease.release(broken)
    }
    let image: { ref: string; image?: AttemptImage }
    try {
      image = await source.ready(engine, info, options.signal)
    } catch (error) {
      // A recipe that can't build is the eval's to fix, not the machine's fault.
      const config = error instanceof PrepareError && error.failure.class === 'config'
      await done(!config)
      if (config || options.signal.aborted || !lease.reused || tries >= SETUP_TRIES) throw error
      debug?.log('container', `${info.id} slot ${lease.slot}: ${(error as Error).message}`)
      continue
    }
    let sandbox: NetworkSandbox
    try {
      // The machine's slots share it evenly.
      const capacity = await dockerCapacity(engine)
      const slots = info.attemptsPerMachine ?? descriptor.attemptsPerMachine ?? 1
      sandbox = await containerSandbox(options, {
        image: image.ref,
        engine,
        fn: o.fn,
        limits: capacity
          ? {
              memory: Math.floor(capacity.memoryBytes / slots),
              cpus: Math.round((capacity.cpus / slots) * 100) / 100,
            }
          : {},
        machine: {
          sandbox: o.sandbox,
          size: info.size || o.size,
          id: info.id,
          name: info.name,
        },
        machineSpan: lease.span,
      })
    } catch (error) {
      await done(true)
      throw error
    }
    const destroy = sandbox.destroy
    let destroyed: Promise<void> | undefined
    return {
      ...sandbox,
      ...(image.image && { image: image.image }),
      destroy: () => {
        destroyed ??= (async () => {
          await destroy()
          await done(false)
        })()
        return destroyed
      },
    }
  }
}
