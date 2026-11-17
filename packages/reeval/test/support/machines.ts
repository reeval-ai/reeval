// The Boat and Daytona sandboxes `place()` makes of a docker() sandbox on `boat()` or `daytona()`,
// for the tests of the code that runs them. Without a recipe or `reevalImage` they're bare
// machines, which only `cloud()` reaches from a plan.
import type { BoatSandboxDescriptor, DaytonaSandboxDescriptor } from '../../src/types.ts'

type Account = { apiKey?: { kind: 'secret'; from: string }; prefix?: string }

export const createBoatSandbox =
  (account: Account = {}) =>
  (o: Partial<Omit<BoatSandboxDescriptor, 'kind'>> = {}): BoatSandboxDescriptor => ({
    kind: 'boat',
    apiKey: account.apiKey ?? { kind: 'secret', from: 'BOAT_API_KEY' },
    prefix: account.prefix ?? 'reeval',
    ...o,
  })
export const boatSandbox = createBoatSandbox()

export const createDaytonaSandbox =
  (account: Account = {}) =>
  (o: Partial<Omit<DaytonaSandboxDescriptor, 'kind'>> = {}): DaytonaSandboxDescriptor => ({
    kind: 'daytona',
    apiKey: account.apiKey ?? { kind: 'secret', from: 'DAYTONA_API_KEY' },
    prefix: account.prefix ?? 'reeval',
    ...o,
  })
export const daytonaSandbox = createDaytonaSandbox()
