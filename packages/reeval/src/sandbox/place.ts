// Where an attempt's sandbox runs: on this machine as written, or on a cloud run's own machines,
// where every attempt gets one of its own and none runs on the machine that runs the run.
import { UsageError } from '../errors.ts'
import type { CloudSandboxDescriptor, SandboxDescriptor } from '../types.ts'
import { recipeOf } from './recipe.ts'

/** Where the run's attempts go: this machine, or the cloud run's machines. */
export type Target = 'here' | 'cloud'

/** A sandbox a cloud run has no machines for, refused before anything is uploaded. */
export class CloudUnsupported extends UsageError {}

/** `sandbox` as `target` runs it; `where` names the eval in a refusal. */
export function place(
  sandbox: SandboxDescriptor,
  target: Target,
  where: string,
): SandboxDescriptor {
  return target === 'here' ? sandbox : onCloud(sandbox, where)
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
      `${where}: podman() runs containers on this machine's Podman, and a cloud run runs each attempt's container on a machine of its own. Use docker(), or run it here with --local.`,
    )
  }
  // The scheduler sets the machine's size and how many attempts share it.
  const { kind: _, engine: __, id: ___, ...container } = sandbox
  const placed: CloudSandboxDescriptor = { kind: 'cloud', ...container }
  return recipeOf(container) ? placed : { ...placed, reevalImage: true }
}
