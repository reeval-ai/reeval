import type { z } from 'zod'
import { AcmeError, invalidRequest } from './errors.ts'
import {
  type AddCartItemInput,
  AddCartItemInputSchema,
  type Cart,
  type CartItem,
  type CreateOrderInput,
  CreateOrderInputSchema,
  IdSchema,
  MAX_ITEM_QUANTITY,
  type Order,
  type OrderListInput,
  OrderListInputSchema,
  PAGE_LIMIT,
  type Page,
  type Product,
  type ProductListInput,
  ProductListInputSchema,
  type ResetResult,
  type StoredCart,
  type TenantState,
  type UpdateCartItemInput,
  UpdateCartItemInputSchema,
} from './schemas.ts'
import { COUPONS, PAYMENT_TOKEN_DECLINED, PRODUCTS, seedState } from './seed.ts'
import type { Store } from './store.ts'

/** The source of time. Tests inject a fixed one. */
export type Clock = () => Date

/** Read the catalog. */
export interface ProductService {
  /**
   * Lists products by id, filtered by a text match on name and description, and by category.
   *
   * @throws AcmeError `invalid_request` for a cursor that is not the id of a product in the list.
   */
  list(input?: ProductListInput): Promise<Page<Product>>
  /** @throws AcmeError `not_found` for an unknown id. */
  get(id: string): Promise<Product>
}

/** Build a cart. */
export interface CartService {
  /** Creates an empty cart. */
  create(): Promise<Cart>
  /** @throws AcmeError `not_found` for an unknown cart. */
  get(id: string): Promise<Cart>
  /**
   * @throws AcmeError `not_found` for an unknown cart or product, or `invalid_request` when the
   * line would pass `MAX_ITEM_QUANTITY`.
   */
  addItem(cartId: string, input: AddCartItemInput): Promise<Cart>
  /** @throws AcmeError `not_found` for an unknown cart, or a product not in the cart. */
  updateItem(cartId: string, productId: string, input: UpdateCartItemInput): Promise<Cart>
  /** @throws AcmeError `not_found` for an unknown cart, or a product not in the cart. */
  removeItem(cartId: string, productId: string): Promise<Cart>
}

/** Place and manage orders. */
export interface OrderService {
  /**
   * Checks out a cart: decrements stock, empties the cart and returns the order.
   *
   * @throws AcmeError `not_found`, `cart_empty`, `insufficient_stock`, `coupon_invalid` or
   * `payment_declined`.
   */
  create(input: CreateOrderInput): Promise<Order>
  /**
   * Lists orders by id.
   *
   * @throws AcmeError `invalid_request` for a cursor that is not the id of an order of any status.
   */
  list(input?: OrderListInput): Promise<Page<Order>>
  /** @throws AcmeError `not_found` for an unknown id. */
  get(id: string): Promise<Order>
  /**
   * Cancels a `paid` order and returns its stock.
   *
   * @throws AcmeError `not_found`, or `order_not_cancelable` for a `shipped` or `canceled` order.
   */
  cancel(id: string): Promise<Order>
}

/**
 * The one contract of acme: the HTTP routes, the SDK and the MCP tools all have these operations.
 * Every error is an `AcmeError`.
 */
export interface AcmeServices {
  products: ProductService
  carts: CartService
  orders: OrderService
  /** Restores the seed data of the tenant. */
  reset(): Promise<ResetResult>
}

/**
 * Implements `AcmeServices` on a store. Ids come from counters in the state and time from `clock`,
 * so the same calls give the same results.
 *
 * @param store - The state of one tenant.
 * @param clock - The source of time.
 */
export function createServices(store: Store, clock: Clock): AcmeServices {
  if (typeof clock !== 'function') {
    throw new TypeError('createServices needs a clock, such as () => new Date()')
  }
  const now = () => clock().toISOString()

  return {
    products: {
      async list(input) {
        const { q, category, cursor, limit } = parse(ProductListInputSchema, input ?? {})
        const state = await store.read()
        const needle = q?.toLowerCase()
        const matches = PRODUCTS.filter(
          (product) =>
            (category === undefined || product.category === category) &&
            (needle === undefined ||
              product.name.toLowerCase().includes(needle) ||
              product.description.toLowerCase().includes(needle)),
        ).map((product) => withStock(product, state))
        if (cursor !== undefined && !matches.some((product) => product.id === cursor)) {
          throw unknownCursor(cursor, 'a product in this list')
        }
        return paginate(matches, cursor, limit)
      },
      async get(id) {
        checkId('productId', id)
        const product = findProduct(id)
        return withStock(product, await store.read())
      },
    },

    carts: {
      async create() {
        return store.transact((state) => {
          const id = nextId('cart', ++state.counters.cart)
          const time = now()
          const cart: StoredCart = { id, items: [], createdAt: time, updatedAt: time }
          state.carts[id] = cart
          return priceCart(cart)
        })
      },
      async get(id) {
        checkId('cartId', id)
        return priceCart(findCart(await store.read(), id))
      },
      async addItem(cartId, input) {
        checkId('cartId', cartId)
        const { productId, quantity } = parse(AddCartItemInputSchema, input)
        return store.transact((state) => {
          const cart = findCart(state, cartId)
          findProduct(productId)
          const line = cart.items.find((item) => item.productId === productId)
          if (line && line.quantity + quantity > MAX_ITEM_QUANTITY) {
            throw new AcmeError(
              'invalid_request',
              `quantity: cart ${cartId} would hold ${line.quantity + quantity} of ${productId}, the most is ${MAX_ITEM_QUANTITY}`,
            )
          }
          if (line) line.quantity += quantity
          else cart.items.push({ productId, quantity })
          cart.updatedAt = now()
          return priceCart(cart)
        })
      },
      async updateItem(cartId, productId, input) {
        checkId('cartId', cartId)
        checkId('productId', productId)
        const { quantity } = parse(UpdateCartItemInputSchema, input)
        return store.transact((state) => {
          const cart = findCart(state, cartId)
          findCartLine(cart, productId).quantity = quantity
          cart.updatedAt = now()
          return priceCart(cart)
        })
      },
      async removeItem(cartId, productId) {
        checkId('cartId', cartId)
        checkId('productId', productId)
        return store.transact((state) => {
          const cart = findCart(state, cartId)
          findCartLine(cart, productId)
          cart.items = cart.items.filter((item) => item.productId !== productId)
          cart.updatedAt = now()
          return priceCart(cart)
        })
      },
    },

    orders: {
      async create(input) {
        const { cartId, paymentToken, couponCode, idempotencyKey } = parse(
          CreateOrderInputSchema,
          input,
        )
        return store.transact((state) => {
          if (idempotencyKey !== undefined) {
            const first = own(state.idempotency, idempotencyKey)
            const existing = first === undefined ? undefined : own(state.orders, first)
            if (existing) return existing
          }

          const cart = findCart(state, cartId)
          if (cart.items.length === 0) throw new AcmeError('cart_empty', `Cart ${cartId} is empty`)
          const priced = priceCart(cart)

          for (const item of priced.items) {
            const available = state.stock[item.productId] ?? 0
            if (item.quantity > available) {
              throw new AcmeError(
                'insufficient_stock',
                `Only ${available} of ${item.productId} in stock, ${item.quantity} requested`,
              )
            }
          }

          const time = now()
          const discountCents =
            couponCode === undefined ? 0 : discountFor(couponCode, priced.subtotalCents, time)

          if (paymentToken === PAYMENT_TOKEN_DECLINED) {
            throw new AcmeError('payment_declined', 'The payment was declined')
          }

          for (const item of priced.items) {
            state.stock[item.productId] = (state.stock[item.productId] ?? 0) - item.quantity
          }
          cart.items = []
          cart.updatedAt = time

          const id = nextId('order', ++state.counters.order)
          const order: Order = {
            id,
            cartId,
            status: 'paid',
            items: priced.items,
            subtotalCents: priced.subtotalCents,
            discountCents,
            totalCents: priced.subtotalCents - discountCents,
            couponCode: couponCode ?? null,
            createdAt: time,
            updatedAt: time,
          }
          state.orders[id] = order
          if (idempotencyKey !== undefined) setOwn(state.idempotency, idempotencyKey, id)
          return order
        })
      },
      async list(input) {
        const { cursor, limit, status } = parse(OrderListInputSchema, input ?? {})
        const state = await store.read()
        if (cursor !== undefined && own(state.orders, cursor) === undefined) {
          throw unknownCursor(cursor, 'an order')
        }
        const matches = Object.values(state.orders).filter(
          (order) => status === undefined || order.status === status,
        )
        return paginate(matches, cursor, limit)
      },
      async get(id) {
        checkId('orderId', id)
        return findOrder(await store.read(), id)
      },
      async cancel(id) {
        checkId('orderId', id)
        return store.transact((state) => {
          const order = findOrder(state, id)
          if (order.status !== 'paid') {
            throw new AcmeError(
              'order_not_cancelable',
              `Order ${id} is ${order.status} and cannot be canceled`,
            )
          }
          for (const item of order.items) {
            state.stock[item.productId] = (state.stock[item.productId] ?? 0) + item.quantity
          }
          order.status = 'canceled'
          order.updatedAt = now()
          return order
        })
      },
    },

    async reset() {
      return store.transact((state) => {
        Object.assign(state, seedState())
        return { ok: true as const }
      })
    },
  }
}

function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value)
  if (!result.success) throw invalidRequest(result.error)
  return result.data
}

/** Ids from a path skip the input schemas, so they are checked against `IdSchema` here. */
function checkId(name: string, id: string): void {
  const result = IdSchema.safeParse(id)
  if (!result.success) {
    throw new AcmeError(
      'invalid_request',
      result.error.issues.map((issue) => `${name}: ${issue.message}`).join('; '),
    )
  }
}

function unknownCursor(cursor: string, item: string): AcmeError {
  return new AcmeError(
    'invalid_request',
    `cursor: "${cursor}" is not the id of ${item}. Pass the nextCursor of the previous page, or no cursor for the first page`,
  )
}

function nextId(prefix: 'cart' | 'order', counter: number): string {
  return `${prefix}_${String(counter).padStart(4, '0')}`
}

function withStock(product: Product, state: TenantState): Product {
  return { ...product, stock: state.stock[product.id] ?? 0 }
}

function findProduct(id: string): Product {
  const product = PRODUCTS.find((candidate) => candidate.id === id)
  if (!product) throw new AcmeError('not_found', `Product ${id} not found`)
  return product
}

/** Ids and idempotency keys come from callers, so `__proto__` or `constructor` must not resolve. */
function own<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined
}

function setOwn<T>(record: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  })
}

function findCart(state: TenantState, id: string): StoredCart {
  const cart = own(state.carts, id)
  if (!cart) throw new AcmeError('not_found', `Cart ${id} not found`)
  return cart
}

function findCartLine(cart: StoredCart, productId: string): StoredCart['items'][number] {
  const line = cart.items.find((item) => item.productId === productId)
  if (!line) throw new AcmeError('not_found', `Product ${productId} is not in cart ${cart.id}`)
  return line
}

function findOrder(state: TenantState, id: string): Order {
  const order = own(state.orders, id)
  if (!order) throw new AcmeError('not_found', `Order ${id} not found`)
  return order
}

function priceCart(cart: StoredCart): Cart {
  const items: CartItem[] = cart.items.map(({ productId, quantity }) => {
    const product = findProduct(productId)
    return {
      productId,
      name: product.name,
      unitPriceCents: product.priceCents,
      quantity,
      lineTotalCents: product.priceCents * quantity,
    }
  })
  return {
    id: cart.id,
    items,
    subtotalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0),
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  }
}

function discountFor(code: string, subtotalCents: number, time: string): number {
  const coupon = COUPONS.find((candidate) => candidate.code === code)
  if (!coupon) throw new AcmeError('coupon_invalid', `Coupon ${code} does not exist`)
  if (coupon.expiresAt !== null && coupon.expiresAt <= time) {
    throw new AcmeError('coupon_invalid', `Coupon ${code} has expired`)
  }
  if (subtotalCents < coupon.minSubtotalCents) {
    throw new AcmeError(
      'coupon_invalid',
      `Coupon ${code} needs a subtotal of at least ${coupon.minSubtotalCents} cents`,
    )
  }
  return coupon.type === 'percent'
    ? Math.floor((subtotalCents * coupon.value) / 100)
    : Math.min(coupon.value, subtotalCents)
}

function compareIds(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)
}

function paginate<T extends { id: string }>(
  items: T[],
  cursor: string | undefined,
  limit: number = PAGE_LIMIT.default,
): Page<T> {
  const sorted = items.toSorted((a, b) => compareIds(a.id, b.id))
  const rest =
    cursor === undefined ? sorted : sorted.filter((item) => compareIds(item.id, cursor) > 0)
  const data = rest.slice(0, limit)
  const last = data.at(-1)
  return { data, nextCursor: rest.length > limit && last ? last.id : null }
}
