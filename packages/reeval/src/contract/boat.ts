// The boat.dev provider's plain-data contract: what `boat()` returns and what a config from any
// language carries, and the internal sandbox `place()` makes of a docker() on it. The types in
// types.ts are the ones users hover, held to these schemas by `_SameAsSchema` below.
import { z } from 'zod'
import { UsageError } from '../errors.ts'
import type {
  BoatApiKey,
  BoatMachineType,
  BoatProviderDescriptor,
  BoatSandboxDescriptor,
} from '../types.ts'
import { VAR } from './plain.ts'
import { oneRecipe, recipeFields } from './recipe.ts'
import { type Assert, closest, got, type Issue, nonEmpty, refusal, type Same } from './shared.ts'

/**
 * Boat's names are 1–63 lowercase letters, digits or dashes. reeval adds `-<run>-<trial>` (16
 * characters) to a sandbox's prefix and `-<harness>-<hash>` (up to 25) to a snapshot's.
 */
export const BOAT_PREFIX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
export const BOAT_PREFIX_MAX = 32

export const BOAT_TYPES = ['small', 'default', 'large', 'xlarge'] as const
/** Slot `n` listens on the gateway's port plus `n`, and a small VM has 2 vCPUs. */
export const BOAT_TRIALS_PER_MACHINE_MAX = 8

const apiKeySchema = z.strictObject({ kind: z.literal('secret'), from: z.string().regex(VAR) })
const prefixSchema = z.string().max(BOAT_PREFIX_MAX).regex(BOAT_PREFIX)
const typeSchema = z.enum(BOAT_TYPES)

const machineFields = {
  type: typeSchema.optional(),
  maxConcurrent: z.number().int().min(1).optional(),
  reuse: z.boolean().optional(),
  trialsPerMachine: z.number().int().min(1).max(BOAT_TRIALS_PER_MACHINE_MAX).optional(),
}

export const boatProviderSchema = z.strictObject({
  kind: z.literal('boat'),
  apiKey: apiKeySchema,
  prefix: prefixSchema,
  ...machineFields,
})

export const boatSandboxSchema = z
  .strictObject({
    kind: z.literal('boat'),
    id: nonEmpty().optional(),
    apiKey: apiKeySchema,
    prefix: prefixSchema,
    ...machineFields,
    ...recipeFields,
    dockerfile: nonEmpty().optional(),
  })
  .superRefine(oneRecipe)

/** `createBoat()`'s argument: the account and naming every machine of the factory shares. */
export type CreateBoatOptions = {
  /** The host variable with the API key, as `secret.fromEnv('BOAT_API_KEY')`. Default `BOAT_API_KEY`. */
  apiKey?: BoatApiKey
  /** The start of every machine name. Default `reeval`. */
  prefix?: string
}

/** `boat()`'s argument. */
export type BoatOptions = Omit<BoatProviderDescriptor, 'kind' | 'apiKey' | 'prefix'>

export const createBoatOptionsSchema = z.strictObject({
  apiKey: apiKeySchema.optional(),
  prefix: prefixSchema.optional(),
})

export const boatOptionsSchema = z.strictObject(machineFields)

export type _SameAsSchema = [
  Assert<Same<z.infer<typeof boatSandboxSchema>, BoatSandboxDescriptor>>,
  Assert<Same<keyof z.infer<typeof boatSandboxSchema>, keyof BoatSandboxDescriptor>>,
  Assert<Same<z.infer<typeof boatProviderSchema>, BoatProviderDescriptor>>,
  Assert<Same<keyof z.infer<typeof boatProviderSchema>, keyof BoatProviderDescriptor>>,
  Assert<Same<z.infer<typeof apiKeySchema>, BoatApiKey>>,
  Assert<Same<z.infer<typeof typeSchema>, BoatMachineType>>,
  Assert<Same<z.input<typeof createBoatOptionsSchema>, CreateBoatOptions>>,
  Assert<Same<z.input<typeof boatOptionsSchema>, BoatOptions>>,
]

/** Docker's options, which a Boat VM doesn't have (yet), and what to do instead. */
const NOT_ON_BOAT: Record<string, string> = {
  root: 'the agent, setup steps and checks run as the unprivileged reeval user, and a Boat sandbox has no root mode yet',
  capabilities: 'a VM has no container capabilities to add',
  devices: 'a Boat VM gets no host devices',
  memory: "pick a machine size with type: 'small' (4 GB), 'default', 'large' or 'xlarge'",
  cpus: "pick a machine size with type: 'small' (2 vCPUs), 'default', 'large' or 'xlarge'",
  swap: "pick a machine size with type: 'small' (4 GB), 'default', 'large' or 'xlarge'",
  pids: 'a VM has no container process limit',
  engine: 'boat() runs on boat.dev, not a container engine',
}

/** The sandbox's options, which go in docker(), not on the provider. */
export const SANDBOX_KEYS = ['id', 'image', 'from', 'dockerfile', 'install']

/** The sentence for a sandbox option given to a provider's helper. */
export const sandboxKeyMessage = (fn: string, key: string) =>
  key === 'id'
    ? `${fn}() takes no \`id\`: the cell is named by its sandbox, docker({ id }).`
    : `${fn}() takes no \`${key}\`: the image goes in docker({ ${key} }), the sandbox.`

const KNOWN = ['type', 'maxConcurrent', 'reuse', 'trialsPerMachine']

const prefixMessage = (v: unknown, where: string) =>
  `${where} takes lowercase letters, digits and dashes, starting and ending with a letter or digit, at most ${BOAT_PREFIX_MAX} characters, e.g. prefix: 'acme-evals' (got ${got(v)})`

function explain(fn: string) {
  return (issue: Issue, value: unknown): string => {
    const options = (value ?? {}) as Record<string, unknown>
    if (issue.code === 'unrecognized_keys' && issue.path.length === 0) {
      const key = issue.keys[0] as string
      if (SANDBOX_KEYS.includes(key)) return sandboxKeyMessage(fn, key)
      if (NOT_ON_BOAT[key]) return `${fn}() doesn't take ${key}: ${NOT_ON_BOAT[key]}.`
      const known = fn === 'createBoat' ? ['apiKey', 'prefix'] : KNOWN
      const near = closest(key, known)
      return `Unknown ${fn}() option "${key}".${near ? ` Did you mean "${near}"?` : ''}`
    }
    const key = String(issue.path[0])
    const v = options[key]
    switch (key) {
      case 'apiKey':
        return typeof v === 'string'
          ? `${fn}({ apiKey }) takes the host variable that holds the key, never the key: apiKey: secret.fromEnv('BOAT_API_KEY'), with secret from a defineConfig callback. The key stays on the host.`
          : `${fn}({ apiKey }) takes secret.fromEnv('<HOST_VARIABLE>') (got ${got(v)})`
      case 'prefix':
        return prefixMessage(v, `${fn}({ prefix })`)
      case 'type':
        return `${fn}({ type }) is one of ${BOAT_TYPES.map((t) => `'${t}'`).join(', ')} (got ${got(v)})`
      case 'maxConcurrent':
        return `${fn}({ maxConcurrent }) takes a whole number of at least 1 (got ${got(v)})`
      case 'reuse':
        return `${fn}({ reuse }) is true or false (got ${got(v)})`
      case 'trialsPerMachine':
        return `${fn}({ trialsPerMachine }) is a whole number from 1 to ${BOAT_TRIALS_PER_MACHINE_MAX} (got ${got(v)})`
      case 'kind':
        return `a Boat provider's kind is "boat" (got ${got(v)})`
      default:
        return `${fn}({ ${key} }) is invalid (got ${got(v)})`
    }
  }
}

/** `createBoat()`'s options, checked; throws reeval's sentence for the first problem. */
export function checkCreateBoatOptions(options: unknown): void {
  const problem = refusal(createBoatOptionsSchema, options, explain('createBoat'), {
    order: ['apiKey', 'prefix'],
  })
  if (problem) throw new UsageError(problem)
}

/** `boat()`'s options, checked; throws reeval's sentence for the first problem. */
export function checkBoatOptions(options: unknown): void {
  const problem = refusal(boatOptionsSchema, options, explain('boat'), {
    order: KNOWN,
  })
  if (problem) throw new UsageError(problem)
}

/** What's wrong with a Boat provider from any source, or undefined. */
export const boatProviderProblem = (value: unknown) =>
  refusal(boatProviderSchema, value, explain('boat'), {
    order: ['kind', 'apiKey', 'prefix', ...KNOWN],
  })
