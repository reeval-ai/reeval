import { type Store, seedState, type TenantState } from '@acme/core'

const STATE_KEY = 'state'

/**
 * A store that keeps the tenant state in a Durable Object's SQLite-backed storage.
 *
 * `transact` reads, runs `fn`, copies its result and writes without an `await` between them. The
 * Durable Object's single thread therefore never interleaves two transactions, and a throwing
 * `fn` or an uncopyable result never reaches the write. Create it inside the Durable Object that
 * owns the storage.
 *
 * @param kv - The object's synchronous key-value storage, `ctx.storage.kv`.
 */
export function createDurableStore(kv: SyncKvStorage): Store {
  if (kv.get(STATE_KEY) === undefined) kv.put(STATE_KEY, seedState())

  function load(): TenantState {
    const state = kv.get<TenantState>(STATE_KEY)
    if (state === undefined) throw new Error('The tenant state is missing from storage')
    return state
  }

  return {
    async read() {
      return load()
    },
    async transact<T>(fn: (state: TenantState) => T): Promise<T> {
      const draft = load()
      const result = structuredClone(fn(draft))
      kv.put(STATE_KEY, draft)
      return result
    },
  }
}
