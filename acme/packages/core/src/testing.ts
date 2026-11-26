import { seedState } from './seed.ts'
import type { Store } from './store.ts'

/** Makes a store holding the seed state. */
export type MakeStore = () => Store | Promise<Store>

/** One check every `Store` passes. */
export interface ConformanceCase {
  name: string
  run(makeStore: MakeStore): Promise<void>
}

/** The checks every `Store` passes. Plain functions, so any test runner can run them. */
export const storeConformanceCases: ConformanceCase[] = [
  {
    name: 'a new store holds the seed state',
    async run(makeStore) {
      const store = await makeStore()
      expectEqual(await store.read(), seedState())
    },
  },
  {
    name: 'transact returns what fn returns and persists what fn changes',
    async run(makeStore) {
      const store = await makeStore()
      const result = await store.transact((state) => {
        state.counters.cart = 7
        return 'done'
      })
      expectEqual(result, 'done')
      expectEqual((await store.read()).counters.cart, 7)
    },
  },
  {
    name: 'read returns a copy',
    async run(makeStore) {
      const store = await makeStore()
      const copy = await store.read()
      copy.counters.order = 99
      expectEqual((await store.read()).counters.order, seedState().counters.order)
    },
  },
  {
    name: 'a transaction sees the changes of the one before it',
    async run(makeStore) {
      const store = await makeStore()
      await store.transact((state) => {
        state.counters.cart += 1
      })
      const seen = await store.transact((state) => state.counters.cart)
      expectEqual(seen, seedState().counters.cart + 1)
    },
  },
  {
    name: 'a transaction that throws persists nothing and rethrows',
    async run(makeStore) {
      const store = await makeStore()
      let thrown: unknown
      try {
        await store.transact((state) => {
          state.counters.cart = 50
          state.stock.prod_001 = 0
          throw new Error('boom')
        })
      } catch (error) {
        thrown = error
      }
      expectEqual(thrown instanceof Error ? thrown.message : thrown, 'boom')
      expectEqual(await store.read(), seedState())
    },
  },
  {
    name: 'concurrent transactions do not lose updates',
    async run(makeStore) {
      const store = await makeStore()
      await Promise.all(
        Array.from({ length: 20 }, () =>
          store.transact((state) => {
            state.counters.cart += 1
          }),
        ),
      )
      expectEqual((await store.read()).counters.cart, seedState().counters.cart + 20)
    },
  },
  {
    name: 'the state stays plain JSON data',
    async run(makeStore) {
      const store = await makeStore()
      await store.transact((state) => {
        state.idempotency.key = 'order_0003'
      })
      expectPlainJson(await store.read(), 'state')
    },
  },
  {
    name: 'transact returns a copy',
    async run(makeStore) {
      const store = await makeStore()
      const returned = await store.transact((state) => state)
      returned.counters.order = 99
      expectEqual((await store.read()).counters.order, seedState().counters.order)
    },
  },
  {
    name: 'a transaction after one that throws runs and persists',
    async run(makeStore) {
      const store = await makeStore()
      await store
        .transact(() => {
          throw new Error('boom')
        })
        .catch(() => undefined)
      await store.transact((state) => {
        state.counters.cart = 3
      })
      expectEqual((await store.read()).counters.cart, 3)
    },
  },
]

/**
 * Registers every conformance case with a test runner.
 *
 * @param name - The name of the store under test.
 * @param makeStore - Makes a store holding the seed state, fresh for each case.
 * @param test - The runner's `test` function.
 */
export function storeConformance(
  name: string,
  makeStore: MakeStore,
  test: (name: string, fn: () => Promise<void>) => void,
): void {
  for (const testCase of storeConformanceCases) {
    test(`${name}: ${testCase.name}`, () => testCase.run(makeStore))
  }
}

function expectEqual(actual: unknown, expected: unknown): void {
  const a = canonical(actual)
  const b = canonical(expected)
  if (a !== b) throw new Error(`expected ${b}, got ${a}`)
}

/** JSON with object keys sorted, so a store may return keys in any order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item,
  )
}

function expectPlainJson(value: unknown, path: string): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} is ${value}, not a JSON number`)
    return
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) expectPlainJson(item, `${path}[${index}]`)
    return
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) expectPlainJson(item, `${path}.${key}`)
    return
  }
  throw new Error(`${path} is not plain JSON data`)
}
