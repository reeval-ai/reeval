// Where a trial's sandbox runs: `place()` puts the sandbox an eval resolved on the run's
// provider's machines, on a cloud run's own machines, or leaves it on the machine reeval runs on.
// Every trial still runs in a sandbox of its own; the provider or the cloud only picks the
// machines.
import { UsageError } from '../errors.ts'
import type {
  BoatSandboxDescriptor,
  CloudSandboxDescriptor,
  DaytonaSandboxDescriptor,
  DockerSandboxDescriptor,
  ProviderDescriptor,
  SandboxDescriptor,
} from '../types.ts'

/** Where the run's trials start: this machine, or the run's own machines on a cloud run. */
export type Target = 'here' | 'cloud'

/** A sandbox a cloud run has no machines for, refused before anything is uploaded. */
export class CloudUnsupported extends UsageError {}

/** The docker() options a provider's container takes as they are. */
const CARRIED = new Set(['kind', 'id', 'image', 'from', 'dockerfile', 'install', 'maxConcurrent'])
const PRIVILEGE = new Set(['root', 'capabilities', 'devices'])
/** `docker()`'s own defaults, which a provider's machines already match. */
const isDefault = (key: string, value: unknown) =>
  (key === 'root' && value === false) ||
  ((key === 'capabilities' || key === 'devices') && Array.isArray(value) && value.length === 0)

/**
 * The sandbox `sandbox` runs as for a trial that starts at `target`; `where` names the eval in
 * a refusal. With a provider, on its machines wherever the trial starts: it takes `docker()`
 * sandboxes only, each a container of the sandbox's image on a machine (reeval's sandbox image for
 * the harness with no recipe). Without one, on a cloud run's machines as the same container, or
 * here as written. The fake sandbox and the machine kinds are placed already.
 */
export function place(
  sandbox: SandboxDescriptor,
  provider: ProviderDescriptor | undefined,
  target: Target,
  where: string,
): SandboxDescriptor {
  if (!provider) return target === 'here' ? sandbox : onCloud(sandbox, where)
  if (sandbox.kind === 'tart' || (sandbox.kind === 'docker' && sandbox.engine === 'podman')) {
    const name = sandbox.kind === 'tart' ? 'tart()' : 'podman()'
    throw new UsageError(`${where}: ${provider.kind}() runs docker() sandboxes, not ${name}.`)
  }
  if (sandbox.kind !== 'docker') return sandbox
  const extra = Object.keys(sandbox).filter((k) => {
    if (CARRIED.has(k) || k === 'engine') return false
    const value = sandbox[k as keyof typeof sandbox]
    return !(value === undefined || isDefault(k, value))
  })
  if (extra.length) {
    const them = extra.length === 1 ? 'it' : 'them'
    const why = [
      extra.some((k) => !PRIVILEGE.has(k)) &&
        `${provider.kind === 'boat' ? 'boat({ type })' : 'daytona({ size })'} sets the machine's size`,
      extra.includes('root') && 'the agent runs as the reeval user',
      extra.includes('capabilities') && `${provider.kind}() adds no capabilities`,
      extra.includes('devices') && `${provider.kind}() passes no host devices`,
    ].filter(Boolean)
    throw new UsageError(
      `${where}: docker({ ${extra.join(', ')} }) applies to a container on your machine, not on ${provider.kind}(): ${why.join(', and ')}. Leave ${them} out.`,
    )
  }
  return provider.kind === 'boat' ? onBoat(sandbox, provider) : onDaytona(sandbox, provider)
}

/** The same container `docker()` runs here, on one of the cloud run's machines. */
function onCloud(sandbox: SandboxDescriptor, where: string): SandboxDescriptor {
  if (sandbox.kind === 'tart') {
    throw new CloudUnsupported(
      `${where}: tart() runs macOS VMs on a Mac, and a cloud run has no Macs. Run it here with --local, or give the eval a docker() sandbox.`,
    )
  }
  if (sandbox.kind !== 'docker') return sandbox
  if (sandbox.engine === 'podman') {
    throw new CloudUnsupported(
      `${where}: podman() runs containers on this machine's Podman, and a cloud run runs each trial's container on a machine of its own. Use docker(), or run it here with --local.`,
    )
  }
  if (sandbox.devices?.length) {
    throw new CloudUnsupported(
      `${where}: docker({ devices }) passes this machine's devices into the container, and a cloud run's machines pass none. Run it here with --local.`,
    )
  }
  // The scheduler sets the machine's size and how many trials share it.
  const { kind: _, engine: __, id: ___, devices: ____, ...container } = sandbox
  return { kind: 'cloud', ...container } satisfies CloudSandboxDescriptor
}

const recipe = ({ image, from, dockerfile, install }: DockerSandboxDescriptor) => ({
  ...(image !== undefined && { image }),
  ...(from !== undefined && { from }),
  ...(dockerfile !== undefined && { dockerfile }),
  ...(install?.length && { install }),
})

function onBoat(
  s: DockerSandboxDescriptor,
  provider: Extract<ProviderDescriptor, { kind: 'boat' }>,
): BoatSandboxDescriptor {
  const maxConcurrent = provider.maxConcurrent ?? s.maxConcurrent
  return {
    ...provider,
    ...(s.id !== undefined && { id: s.id }),
    ...recipe(s),
    ...(maxConcurrent !== undefined && { maxConcurrent }),
  }
}

function onDaytona(
  s: DockerSandboxDescriptor,
  provider: Extract<ProviderDescriptor, { kind: 'daytona' }>,
): DaytonaSandboxDescriptor {
  const maxConcurrent = provider.maxConcurrent ?? s.maxConcurrent
  return {
    ...provider,
    ...(s.id !== undefined && { id: s.id }),
    ...recipe(s),
    ...(maxConcurrent !== undefined && { maxConcurrent }),
  }
}
