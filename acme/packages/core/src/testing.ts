import type { Cart, Order, Page, Product } from './schemas.ts'
import { seedState } from './seed.ts'
import type { AcmeServices } from './services.ts'
import type { Store } from './store.ts'

/** Makes a store holding the seed state. */
export type MakeStore = () => Store | Promise<Store>

/** One check every `Store` passes. */
export interface ConformanceCase {
  name: string
  run(makeStore: MakeStore): Promise<void>
}

/**
 * The checks every `Store` passes. Each is a plain function, so `node:test` and vitest register them
 * alike: `for (const c of storeConformanceCases) test(c.name, () => c.run(makeStore))`.
 */
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

/** The product every stub service returns. */
export const product: Product = {
  id: 'prod_003',
  name: 'Headphones',
  description: 'Over-ear',
  category: 'audio',
  priceCents: 1250,
  stock: 7,
}

/** The cart every stub service returns. */
export const cart: Cart = {
  id: 'cart_0001',
  items: [
    {
      productId: 'prod_003',
      name: 'Headphones',
      unitPriceCents: 1250,
      quantity: 2,
      lineTotalCents: 2500,
    },
  ],
  subtotalCents: 2500,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:01.000Z',
}

/** The order every stub service returns, but `orders.cancel`, which returns it canceled. */
export const order: Order = {
  id: 'order_0001',
  cartId: 'cart_0001',
  status: 'paid',
  items: cart.items,
  subtotalCents: 2500,
  discountCents: 250,
  totalCents: 2250,
  couponCode: 'WELCOME10',
  createdAt: '2026-01-01T00:00:02.000Z',
  updatedAt: '2026-01-01T00:00:02.000Z',
}

/** The page of products every stub service returns. */
export const productPage: Page<Product> = { data: [product], nextCursor: 'prod_003' }

/** The page of orders every stub service returns. */
export const orderPage: Page<Order> = { data: [order], nextCursor: null }

/** One call a stub service received, such as `{ method: 'carts.get', args: ['cart_0001'] }`. */
export interface ServiceCall {
  method: string
  args: unknown[]
}

/**
 * A stub `AcmeServices` that records each call in `calls` and answers with the fixtures above.
 * Replace a method on `services` to make it answer otherwise or throw.
 */
export function recordingServices(): { services: AcmeServices; calls: ServiceCall[] } {
  const calls: ServiceCall[] = []
  const record =
    <T>(method: string, result: T) =>
    async (...args: unknown[]): Promise<T> => {
      calls.push({ method, args })
      return result
    }
  const services: AcmeServices = {
    products: {
      list: record('products.list', productPage),
      get: record('products.get', product),
    },
    carts: {
      create: record('carts.create', cart),
      get: record('carts.get', cart),
      addItem: record('carts.addItem', cart),
      updateItem: record('carts.updateItem', cart),
      removeItem: record('carts.removeItem', cart),
    },
    orders: {
      create: record('orders.create', order),
      list: record('orders.list', orderPage),
      get: record('orders.get', order),
      cancel: record('orders.cancel', { ...order, status: 'canceled' as const }),
    },
    reset: record('reset', { ok: true as const }),
  }
  return { services, calls }
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
