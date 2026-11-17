// `reeval/provider/daytona`: Daytona sandboxes that run each attempt's sandbox. This module only
// describes them; Daytona's SDK (`@daytona/sdk`, an optional peer) loads in the worker that starts
// one.
import {
  type CreateDaytonaOptions,
  checkCreateDaytonaOptions,
  checkDaytonaOptions,
  type DaytonaOptions,
} from './contract/daytona.ts'
import { UsageError } from './errors.ts'
import type { DaytonaProviderDescriptor } from './types.ts'

export type { CreateDaytonaOptions, DaytonaOptions } from './contract/daytona.ts'
export type { DaytonaApiKey, DaytonaProviderDescriptor, DaytonaSize } from './types.ts'

const isOptions = (value: unknown) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * A `daytona()` for one Daytona organization and name prefix: `apiKey` names the host variable
 * with the API key (`secret.fromEnv('DAYTONA_API_KEY')` by default), and `prefix` starts every
 * sandbox name reeval gives Daytona (`reeval` by default), so a run's cleanup deletes only its own.
 */
export function createDaytona(
  options: CreateDaytonaOptions = {},
): (options?: DaytonaOptions) => DaytonaProviderDescriptor {
  if (!isOptions(options)) {
    throw new UsageError(`createDaytona() takes an options object (got ${JSON.stringify(options)})`)
  }
  checkCreateDaytonaOptions(options)
  const apiKey = { kind: 'secret' as const, from: options.apiKey?.from ?? 'DAYTONA_API_KEY' }
  const prefix = options.prefix ?? 'reeval'
  return (machine: DaytonaOptions = {}) => {
    if (!isOptions(machine)) {
      throw new UsageError(`daytona() takes an options object (got ${JSON.stringify(machine)})`)
    }
    checkDaytonaOptions(machine)
    return { kind: 'daytona', apiKey, prefix, ...structuredClone(machine) }
  }
}

/**
 * Daytona sandboxes, on the organization whose key is in `DAYTONA_API_KEY`, as the config's or a
 * profile's `provider`. Each attempt runs in a Daytona sandbox built from its `docker()`
 * sandbox's image recipe, reeval's sandbox image without one; credentials stay on the host behind
 * the egress gateway. Needs `npm i @daytona/sdk` and `egress: 'allow-all'`.
 */
export const daytona = createDaytona()
