// The sandbox descriptors' plain-data contract: what `docker()`, `podman()` and `fakeSandbox()` return and
// what a declaration tree from any language carries. The Zod schemas are the source of truth for
// validation and the JSON Schema in schema/plan/; the types in types.ts are the hand-written ones
// users hover, whose TSDoc describes the fields, held to the schemas by `_SameAsSchema` below.
import { z } from 'zod'
import { UsageError } from '../errors.ts'
import type {
  DockerSandboxDescriptor,
  Duration,
  FakeSandboxDescriptor,
  InstallStep,
  SandboxDescriptor,
} from '../types.ts'
import { boatProblem } from './boat.ts'
import { cloudProblem } from './cloud.ts'
import { containerFieldMessage, containerFields } from './container.ts'
import { daytonaProblem } from './daytona.ts'
import {
  installMessage,
  type installStepSchema,
  oneRecipe,
  recipeFieldMessage,
  recipeFields,
  recipeMessage,
} from './recipe.ts'
import {
  type Assert,
  closest,
  type durationSchema,
  got,
  type Issue,
  nonEmpty,
  refusal,
  type Same,
} from './shared.ts'
import { tartProblem } from './tart.ts'

/** Every field but `kind` and `dockerfile`, shared by the descriptor and `docker()`'s options. */
const fields = {
  id: nonEmpty().optional(),
  ...recipeFields,
  maxConcurrent: z.number().optional(),
  ...containerFields,
}

export const dockerSandboxSchema = z
  .strictObject({
    kind: z.literal('docker'),
    engine: z.enum(['docker', 'podman']).optional(),
    ...fields,
    dockerfile: nonEmpty().optional(),
  })
  .superRefine(oneRecipe)

export const fakeSandboxSchema = z.strictObject({
  kind: z.literal('fake'),
  id: nonEmpty().optional(),
  dir: nonEmpty().optional(),
  maxConcurrent: z.number().optional(),
})

/** `docker()`'s argument: the descriptor's fields, with `dockerfile` relative or a `file:` URL. */
export const dockerOptionsSchema = z
  .strictObject({
    ...fields,
    dockerfile: z.union([nonEmpty(), z.instanceof(URL)]).optional(),
  })
  .superRefine(oneRecipe)

/** `docker()`'s (and `podman()`'s) argument, as users write it. */
export type DockerOptions = Omit<DockerSandboxDescriptor, 'kind' | 'engine' | 'dockerfile'> & {
  /** Relative to the file that calls `docker()`, or an absolute path or `URL`. */
  dockerfile?: string | URL
}

export type _SameAsSchema = [
  Assert<Same<z.infer<typeof dockerSandboxSchema>, DockerSandboxDescriptor>>,
  Assert<Same<keyof z.infer<typeof dockerSandboxSchema>, keyof DockerSandboxDescriptor>>,
  Assert<Same<z.infer<typeof fakeSandboxSchema>, FakeSandboxDescriptor>>,
  Assert<Same<keyof z.infer<typeof fakeSandboxSchema>, keyof FakeSandboxDescriptor>>,
  Assert<Same<z.input<typeof dockerOptionsSchema>, DockerOptions>>,
  Assert<Same<z.infer<typeof installStepSchema>, InstallStep>>,
  Assert<Same<z.infer<typeof durationSchema>, Duration>>,
]

const DOCKER_HINTS: Record<string, string> = {
  steps: 'install',
  run: 'install',
  setup: 'install',
  image_steps: 'install',
  file: 'dockerfile',
  build: 'dockerfile',
  base: 'from',
  user: 'root',
  privileged: 'root',
  capAdd: 'capabilities',
  caps: 'capabilities',
  mem: 'memory',
  memoryLimit: 'memory',
  memorySwap: 'swap',
  memswap: 'swap',
  cpu: 'cpus',
  pidsLimit: 'pids',
}

/** The sentence for a field whose value the schema refused, given the value. */
const FIELD: Record<string, (value: unknown) => string> = {
  id: (v) => `docker({ id }) must be a non-empty string (got ${got(v)})`,
  maxConcurrent: (v) => `docker({ maxConcurrent }) takes a number (got ${got(v)})`,
  kind: (v) => `a Docker sandbox's kind is "docker" (got ${got(v)})`,
  engine: (v) => `a Docker sandbox's engine is "docker" or "podman" (got ${got(v)})`,
}

/** Which refusal to report when there are several: the order `docker()` has always checked in. */
const ORDER = [
  'kind',
  'engine',
  'id',
  'image',
  'from',
  'root',
  'capabilities',
  'memory',
  'swap',
  'cpus',
  'pids',
]

/** reeval's sentence for the first thing Zod refused, in the words `docker()` has always used. */
function explainDocker(issue: Issue, value: unknown): string {
  const options = value as Record<string, unknown>
  if (issue.code === 'unrecognized_keys' && issue.path.length === 0) {
    const key = issue.keys[0] as string
    if (key === 'environment' || key === 'env') {
      return `Unknown docker() option "${key}". The sandbox is what's baked into the image; variables and secrets belong in defineEnvironment({ env }).`
    }
    const hint = DOCKER_HINTS[key] ? ` Did you mean "${DOCKER_HINTS[key]}"?` : ''
    return `Unknown docker() option "${key}".${hint}`
  }
  if (issue.path[0] === 'install' && issue.path.length > 1) {
    return installMessage('docker', (options.install as unknown[])[issue.path[1] as number])
  }
  if (issue.code === 'custom') return recipeMessage('docker', issue.params)
  const key = String(issue.path[0])
  return (
    recipeFieldMessage('docker', key, options[key]) ??
    containerFieldMessage('docker', key, options[key]) ??
    (FIELD[key] ?? ((v) => `docker({ ${key} }) is invalid (got ${got(v)})`))(options[key])
  )
}

function explainFake(issue: Issue, value: unknown): string {
  if (issue.code === 'unrecognized_keys' && issue.path.length === 0) {
    const key = issue.keys[0] as string
    const near = closest(key, Object.keys(fakeSandboxSchema.shape))
    return `Unknown fakeSandbox() option "${key}".${near ? ` Did you mean "${near}"?` : ''}`
  }
  const key = String(issue.path[0])
  const v = (value as Record<string, unknown>)[key]
  return key === 'maxConcurrent'
    ? `fakeSandbox({ maxConcurrent }) takes a number (got ${got(v)})`
    : `fakeSandbox({ ${key} }) must be a non-empty string (got ${got(v)})`
}

/** A refusal in the words of the function that makes the sandbox: `podman({ memory })`. */
const named = (problem: string | undefined, engine: 'docker' | 'podman' | undefined) =>
  problem && engine === 'podman'
    ? problem.replace(/\bdocker\(/g, 'podman(').replace(/\bA Docker sandbox/g, 'A Podman sandbox')
    : problem

/** `docker()`'s (or `podman()`'s) options, checked; throws reeval's sentence for the first problem. */
export function checkDockerOptions(options: DockerOptions, engine?: 'docker' | 'podman'): void {
  const problem = named(
    refusal(dockerOptionsSchema, options, explainDocker, { order: ORDER }),
    engine,
  )
  if (problem) throw new UsageError(problem)
}

/**
 * What's wrong with a sandbox descriptor of a known kind from any source (a declaration tree, a
 * config), or undefined. `maxConcurrent` is left to the check that names where it was set.
 */
export function sandboxProblem(value: SandboxDescriptor) {
  if (value.kind === 'tart') return tartProblem(value)
  if (value.kind === 'boat') return boatProblem(value)
  if (value.kind === 'daytona') return daytonaProblem(value)
  if (value.kind === 'cloud') return cloudProblem(value)
  return value.kind === 'docker'
    ? named(
        refusal(dockerSandboxSchema, value, explainDocker, {
          order: ORDER,
          skip: ['maxConcurrent'],
        }),
        value.engine,
      )
    : refusal(fakeSandboxSchema, value, explainFake, { skip: ['maxConcurrent'] })
}
