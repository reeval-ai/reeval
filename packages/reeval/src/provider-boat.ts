// `reeval/provider/boat`: boat.dev machines that run each attempt's sandbox. This module only
// describes them; the Boat SDK (`@boatdev/sdk`, an optional peer) loads in the worker that starts
// one.
import {
  type BoatOptions,
  type CreateBoatOptions,
  checkBoatOptions,
  checkCreateBoatOptions,
} from './contract/boat.ts'
import { UsageError } from './errors.ts'
import type { BoatProviderDescriptor } from './types.ts'

export type { BoatOptions, CreateBoatOptions } from './contract/boat.ts'
export type { BoatApiKey, BoatMachineType, BoatProviderDescriptor } from './types.ts'

const isOptions = (value: unknown) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * A `boat()` for one Boat account and name prefix: `apiKey` names the host variable with the API
 * key (`secret.fromEnv('BOAT_API_KEY')` by default), and `prefix` starts every machine name
 * reeval gives Boat (`reeval` by default), so a run's cleanup deletes only its own.
 */
export function createBoat(
  options: CreateBoatOptions = {},
): (options?: BoatOptions) => BoatProviderDescriptor {
  if (!isOptions(options)) {
    throw new UsageError(`createBoat() takes an options object (got ${JSON.stringify(options)})`)
  }
  checkCreateBoatOptions(options)
  const apiKey = { kind: 'secret' as const, from: options.apiKey?.from ?? 'BOAT_API_KEY' }
  const prefix = options.prefix ?? 'reeval'
  return (machine: BoatOptions = {}) => {
    if (!isOptions(machine)) {
      throw new UsageError(`boat() takes an options object (got ${JSON.stringify(machine)})`)
    }
    checkBoatOptions(machine)
    return { kind: 'boat', apiKey, prefix, ...structuredClone(machine) }
  }
}

/**
 * boat.dev machines, on the account whose key is in `BOAT_API_KEY`, as the config's or a
 * profile's `provider`. Each attempt runs in a container of its `docker()` sandbox's image on a
 * machine, where every egress policy is enforced; credentials stay on the host behind the egress
 * gateway. Preflight builds the image once into a Boat saved snapshot. Needs `npm i @boatdev/sdk`.
 */
export const boat = createBoat()
