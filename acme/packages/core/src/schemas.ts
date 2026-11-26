import { z } from 'zod'

/** The page size used when a list call gives none, and the largest page size. */
export const PAGE_LIMIT = { default: 10, max: 50 } as const

/** Largest quantity of one product in a cart. */
export const MAX_ITEM_QUANTITY = 99

/** The statuses an order moves through. */
export const OrderStatusSchema = z.enum(['paid', 'shipped', 'canceled'])
/** One of `paid`, `shipped` or `canceled`. */
export type OrderStatus = z.infer<typeof OrderStatusSchema>

/** The longest free string an input takes. */
export const MAX_STRING_LENGTH = 255

/** An id taken from a path or a tool argument. */
export const IdSchema = z.string().min(1).max(MAX_STRING_LENGTH)

/** The product categories, in catalog order. */
export const CATEGORIES = ['audio', 'computing', 'home', 'outdoors'] as const

/** One of the product categories. */
export const CategorySchema = z.enum(CATEGORIES)
/** One of `audio`, `computing`, `home` or `outdoors`. */
export type Category = z.infer<typeof CategorySchema>

/** A product in the catalog. Money is integer cents in USD. */
export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: CategorySchema,
  priceCents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
})
/** A product in the catalog. */
export type Product = z.infer<typeof ProductSchema>

/** A priced line of a cart or an order. */
export const CartItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  unitPriceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  lineTotalCents: z.number().int().nonnegative(),
})
/** A priced line of a cart or an order. */
export type CartItem = z.infer<typeof CartItemSchema>

/** A cart with its priced items and subtotal. */
export const CartSchema = z.object({
  id: z.string(),
  items: z.array(CartItemSchema),
  subtotalCents: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
/** A cart with its priced items and subtotal. */
export type Cart = z.infer<typeof CartSchema>

/** An order. The items and prices are those of the cart at checkout. */
export const OrderSchema = z.object({
  id: z.string(),
  cartId: z.string(),
  status: OrderStatusSchema,
  items: z.array(CartItemSchema),
  subtotalCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  couponCode: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
/** An order. */
export type Order = z.infer<typeof OrderSchema>

/**
 * A coupon. `percent` takes `value` percent off the subtotal, rounded down. `fixed` takes `value`
 * cents off. A null `expiresAt` never expires.
 */
export const CouponSchema = z.object({
  code: z.string(),
  type: z.enum(['percent', 'fixed']),
  value: z.number().int().positive(),
  minSubtotalCents: z.number().int().nonnegative(),
  expiresAt: z.iso.datetime().nullable(),
})
/** A coupon. */
export type Coupon = z.infer<typeof CouponSchema>

/**
 * Builds the schema of one page of a list. `nextCursor` is null on the last page.
 *
 * @param item - The schema of one item.
 */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), nextCursor: z.string().nullable() })
}

/** One page of a list, with the cursor of the next page. */
export interface Page<T> {
  data: T[]
  nextCursor: string | null
}

const limit = z.number().int().min(1).max(PAGE_LIMIT.max)
const textLimit = z
  .string()
  .regex(/^[0-9]+$/, 'Expected an integer in decimal digits, such as 10')
  .transform(Number)
  .pipe(limit)
const cursor = z.string().max(MAX_STRING_LENGTH)

/**
 * Input of `products.list`. A `cursor` must be the id of a product in the list being paged, that
 * is, one that matches `q` and `category`.
 */
export const ProductListInputSchema = z.strictObject({
  q: z.string().max(MAX_STRING_LENGTH).optional(),
  category: CategorySchema.optional(),
  cursor: cursor.optional(),
  limit: limit.optional(),
})
/** Input of `products.list`. */
export type ProductListInput = z.infer<typeof ProductListInputSchema>

/** `ProductListInputSchema` for a query string, where `limit` arrives as text. */
export const ProductListQuerySchema = ProductListInputSchema.extend({
  limit: textLimit.optional(),
})

/** Input of `carts.addItem`. Adding a product already in the cart adds to its quantity. */
export const AddCartItemInputSchema = z.strictObject({
  productId: IdSchema,
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
})
/** Input of `carts.addItem`. */
export type AddCartItemInput = z.infer<typeof AddCartItemInputSchema>

/** Input of `carts.updateItem`. It sets the quantity. Use `carts.removeItem` to remove. */
export const UpdateCartItemInputSchema = z.strictObject({
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
})
/** Input of `carts.updateItem`. */
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemInputSchema>

/**
 * Input of `orders.create`. A repeated `idempotencyKey` returns the first order and creates
 * nothing. Over HTTP it travels in the `Idempotency-Key` header.
 */
export const CreateOrderInputSchema = z.strictObject({
  cartId: IdSchema,
  paymentToken: z.string().min(1).max(MAX_STRING_LENGTH),
  couponCode: z.string().min(1).max(MAX_STRING_LENGTH).optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
})
/** Input of `orders.create`. */
export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>

/**
 * Input of `orders.list`. A `cursor` must be the id of an order of the tenant, whatever its
 * status, so a cursor stays valid when its order changes status between pages.
 */
export const OrderListInputSchema = z.strictObject({
  cursor: cursor.optional(),
  limit: limit.optional(),
  status: OrderStatusSchema.optional(),
})
/** Input of `orders.list`. */
export type OrderListInput = z.infer<typeof OrderListInputSchema>

/** `OrderListInputSchema` for a query string, where `limit` arrives as text. */
export const OrderListQuerySchema = OrderListInputSchema.extend({
  limit: textLimit.optional(),
})

/** Result of `reset`. */
export const ResetResultSchema = z.object({ ok: z.literal(true) })
/** Result of `reset`. */
export type ResetResult = z.infer<typeof ResetResultSchema>

/** What one tenant stores for a cart. Prices are looked up when the cart is read. */
export const StoredCartSchema = z.object({
  id: z.string(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
/** What one tenant stores for a cart. */
export type StoredCart = z.infer<typeof StoredCartSchema>

/** The whole state of one tenant: plain JSON. */
export const TenantStateSchema = z.object({
  carts: z.record(z.string(), StoredCartSchema),
  orders: z.record(z.string(), OrderSchema),
  stock: z.record(z.string(), z.number().int().nonnegative()),
  counters: z.object({
    cart: z.number().int().nonnegative(),
    order: z.number().int().nonnegative(),
  }),
  idempotency: z.record(z.string(), z.string()),
})
/** The whole state of one tenant. It is plain JSON, so any store can persist it. */
export type TenantState = z.infer<typeof TenantStateSchema>
