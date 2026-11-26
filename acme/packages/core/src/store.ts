import type { TenantState } from './schemas.ts'
import { seedState } from './seed.ts'

/**
 * Persistence for the state of one tenant, as one JSON document.
 *
 * `transact` runs `fn` with the state, and persists the changes `fn` makes to it. `fn` is
 * synchronous. If `fn` throws, nothing is persisted and the error is rethrown. Transactions on one
 * store never interleave.
 */
export interface Store {
  /** A copy of the state. Changing it does not change the store. */
  read(): Promise<TenantState>
  /**
   * Runs `fn` on the state and persists its changes atomically.
   *
   * @param fn - Synchronous. It may change the state it gets.
   * @returns What `fn` returns.
   */
  transact<T>(fn: (state: TenantState) => T): Promise<T>
}

/**
 * A store that keeps the state in memory.
 *
 * @param initial - The first state. Defaults to the seed data.
 */
export function createMemoryStore(initial: TenantState = seedState()): Store {
  let current = structuredClone(initial)
  return {
    async read() {
      return structuredClone(current)
    },
    async transact<T>(fn: (state: TenantState) => T): Promise<T> {
      const draft = structuredClone(current)
      const result = structuredClone(fn(draft))
      current = draft
      return result
    },
  }
}
