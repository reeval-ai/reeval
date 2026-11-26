import type { AcmeServices, Cart, Order, Page, Product } from '@acme/core'
import { run } from '../src/run.ts'

export const product: Product = {
  id: 'prod_003',
  name: 'Headphones',
  description: 'Over-ear',
  category: 'audio',
  priceCents: 1250,
  stock: 7,
}

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

export const productPage: Page<Product> = { data: [product], nextCursor: 'prod_003' }
export const orderPage: Page<Order> = { data: [order], nextCursor: null }

export interface Call {
  method: string
  args: unknown[]
}

/** A stub `AcmeServices` that records each call and answers with fixtures. */
export function stubServices(): { services: AcmeServices; calls: Call[] } {
  const calls: Call[] = []
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
      cancel: record('orders.cancel', order),
    },
    reset: record('reset', { ok: true as const }),
  }
  return { services, calls }
}

export interface Result {
  code: number
  stdout: string
  stderr: string
  calls: Call[]
}

/** Runs the CLI in-process against `services` (a recording stub by default). */
export async function exec(argv: string[], services?: () => AcmeServices): Promise<Result> {
  const stub = stubServices()
  let stdout = ''
  let stderr = ''
  const code = await run(argv, {
    services: services ?? (() => stub.services),
    stdout: (text) => {
      stdout += text
    },
    stderr: (text) => {
      stderr += text
    },
  })
  return { code, stdout, stderr, calls: stub.calls }
}
