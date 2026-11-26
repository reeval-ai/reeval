import {
  type AcmeServices,
  AddCartItemInputSchema,
  CATEGORIES,
  CartSchema,
  COUPONS,
  type Coupon,
  CreateOrderInputSchema,
  IdSchema,
  isAcmeConnectionError,
  isAcmeError,
  MAX_ITEM_QUANTITY,
  MAX_STRING_LENGTH,
  OrderListInputSchema,
  OrderSchema,
  PAGE_LIMIT,
  PAYMENT_TOKEN_DECLINED,
  ProductListInputSchema,
  ProductSchema,
  pageSchema,
  UpdateCartItemInputSchema,
} from '@acme/core'
import type { CallToolResult } from '@modelcontextprotocol/server'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

const cartId = IdSchema.describe('Cart id from create_cart, such as "cart_0001".')
const orderId = IdSchema.describe('Order id from checkout or list_orders, such as "order_0001".')
const productId = IdSchema.describe('Product id from search_products, such as "prod_003".')
const CURSOR = 'nextCursor of the previous page. Omit it for the first page.'
const LIMIT = `Items for each page, 1 to ${PAGE_LIMIT.max}. Defaults to ${PAGE_LIMIT.default}.`
const PAGE_SIZE = `${PAGE_LIMIT.default} by default and at most ${PAGE_LIMIT.max} for each page`
const QUANTITY = `1 to ${MAX_ITEM_QUANTITY}`

const ProductPageSchema = pageSchema(ProductSchema)
const OrderPageSchema = pageSchema(OrderSchema)

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const

const MONEY = 'Money is integer cents in USD (1999 is $19.99).'

function couponText({ code, type, value, minSubtotalCents, expiresAt }: Coupon): string {
  // Every coupon with an expiry expired before any clock this service runs on.
  if (expiresAt !== null) return `"${code}" is expired`
  const off = type === 'percent' ? `${value}% off` : `${value} cents off`
  const minimum = minSubtotalCents > 0 ? ` a subtotal of at least ${minSubtotalCents}` : ''
  return `"${code}" takes ${off}${minimum}`
}

const COUPON_TEXTS = COUPONS.map(couponText)
const COUPONS_TEXT = `${COUPON_TEXTS.slice(0, -1).join(', ')}, and ${COUPON_TEXTS.at(-1)}`

/**
 * Builds the acme MCP server. Every tool calls only `services`, so the same server runs over stdio
 * against the SDK and over HTTP against the store.
 *
 * @param services - The operations the tools call.
 */
export function buildServer(services: AcmeServices): McpServer {
  const server = new McpServer({ name: 'acme', version: '0.0.0' })

  server.registerTool(
    'search_products',
    {
      title: 'Search products',
      description: [
        `Lists products of the acme catalog, ${PAGE_SIZE}, ordered by id.`,
        'Filter by text with `q` and by `category`.',
        'Returns { data: Product[], nextCursor }. Pass nextCursor as `cursor` for the next page; it is null on the last page.',
        'A Product has id, name, description, category, priceCents and stock. A product with stock 0 cannot be bought.',
        MONEY,
        'Start here to find product ids for add_cart_item.',
        'Errors: invalid_request for a cursor that is not the id of a product in the list filtered by q and category.',
      ].join(' '),
      inputSchema: ProductListInputSchema.extend({
        q: ProductListInputSchema.shape.q.describe(
          'Text to find in the name or description, ignoring case, such as "headphones".',
        ),
        category: ProductListInputSchema.shape.category.describe(
          `Exact category, lowercase: ${CATEGORIES.map((name) => `"${name}"`).join(', ')}.`,
        ),
        cursor: ProductListInputSchema.shape.cursor.describe(CURSOR),
        limit: ProductListInputSchema.shape.limit.describe(LIMIT),
      }),
      outputSchema: ProductPageSchema,
      annotations: { ...READ_ONLY, idempotentHint: true },
    },
    (input) => respond(() => services.products.list(input)),
  )

  server.registerTool(
    'get_product',
    {
      title: 'Get a product',
      description: [
        'Returns one product by id: id, name, description, category, priceCents and the current stock.',
        MONEY,
        'Errors: not_found for an unknown product id.',
      ].join(' '),
      inputSchema: z.strictObject({ productId }),
      outputSchema: ProductSchema,
      annotations: { ...READ_ONLY, idempotentHint: true },
    },
    ({ productId }) => respond(() => services.products.get(productId)),
  )

  server.registerTool(
    'create_cart',
    {
      title: 'Create a cart',
      description: [
        'Creates an empty cart and returns it: { id, items, subtotalCents, createdAt, updatedAt }.',
        'Use the returned id with add_cart_item, then checkout.',
        'Each call creates a new cart, so calling it twice gives two carts.',
      ].join(' '),
      inputSchema: z.strictObject({}),
      outputSchema: CartSchema,
      annotations: { ...WRITE, idempotentHint: false },
    },
    () => respond(() => services.carts.create()),
  )

  server.registerTool(
    'get_cart',
    {
      title: 'Get a cart',
      description: [
        'Returns a cart with its priced items and subtotalCents.',
        'Each item has productId, name, unitPriceCents, quantity and lineTotalCents.',
        MONEY,
        'A cart is empty after a successful checkout.',
        'Errors: not_found for an unknown cart id.',
      ].join(' '),
      inputSchema: z.strictObject({ cartId }),
      outputSchema: CartSchema,
      annotations: { ...READ_ONLY, idempotentHint: true },
    },
    ({ cartId }) => respond(() => services.carts.get(cartId)),
  )

  server.registerTool(
    'add_cart_item',
    {
      title: 'Add a product to a cart',
      description: [
        `Adds \`quantity\` (${QUANTITY}) of a product to a cart and returns the updated cart.`,
        'Adding a product that is already in the cart adds to its quantity; use update_cart_item to set the quantity instead.',
        'Stock is checked at checkout, not here.',
        `A cart line holds at most ${MAX_ITEM_QUANTITY}: an add that would take it past ${MAX_ITEM_QUANTITY} changes nothing and fails with invalid_request, such as "invalid_request: quantity: cart cart_0001 would hold ${MAX_ITEM_QUANTITY + 1} of prod_003, the most is ${MAX_ITEM_QUANTITY}".`,
        'Errors: not_found for an unknown cart or product.',
        'Chain: create_cart, then add_cart_item for each product, then checkout.',
      ].join(' '),
      inputSchema: z.strictObject({
        cartId,
        productId,
        quantity: AddCartItemInputSchema.shape.quantity.describe(`How many to add, ${QUANTITY}.`),
      }),
      outputSchema: CartSchema,
      annotations: { ...WRITE, idempotentHint: false },
    },
    ({ cartId, ...input }) => respond(() => services.carts.addItem(cartId, input)),
  )

  server.registerTool(
    'update_cart_item',
    {
      title: 'Set the quantity of a cart item',
      description: [
        `Sets the quantity (${QUANTITY}) of a product already in a cart and returns the updated cart.`,
        'Use remove_cart_item to take a product out.',
        'Errors: not_found for an unknown cart or a product that is not in the cart.',
      ].join(' '),
      inputSchema: z.strictObject({
        cartId,
        productId,
        quantity: UpdateCartItemInputSchema.shape.quantity.describe(
          `The new quantity, ${QUANTITY}.`,
        ),
      }),
      outputSchema: CartSchema,
      annotations: { ...WRITE, idempotentHint: true },
    },
    ({ cartId, productId, ...input }) =>
      respond(() => services.carts.updateItem(cartId, productId, input)),
  )

  server.registerTool(
    'remove_cart_item',
    {
      title: 'Remove a product from a cart',
      description: [
        'Removes a product from a cart and returns the updated cart.',
        'Errors: not_found for an unknown cart or a product that is not in the cart.',
      ].join(' '),
      inputSchema: z.strictObject({ cartId, productId }),
      outputSchema: CartSchema,
      annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
    },
    ({ cartId, productId }) => respond(() => services.carts.removeItem(cartId, productId)),
  )

  server.registerTool(
    'checkout',
    {
      title: 'Check out a cart',
      description: [
        'Turns a cart into an order with status "paid", takes the stock and empties the cart. Returns the order:',
        'id, cartId, status, items, subtotalCents, discountCents, totalCents, couponCode, createdAt, updatedAt.',
        MONEY,
        `Coupons: ${COUPONS_TEXT}.`,
        'Pass an `idempotencyKey` to make a retry safe: a repeated key returns the first order and creates nothing.',
        'Errors: not_found (unknown cart), cart_empty, insufficient_stock, coupon_invalid (unknown or expired code, or minimum spend not met), payment_declined.',
        'A failed checkout changes nothing, so fix the cause (for example update_cart_item, another couponCode or none) and call checkout again.',
        'Chain: create_cart, add_cart_item, then checkout; read the result with get_order.',
      ].join(' '),
      inputSchema: CreateOrderInputSchema.extend({
        cartId,
        paymentToken: CreateOrderInputSchema.shape.paymentToken.describe(
          `"${PAYMENT_TOKEN_DECLINED}" is declined with payment_declined; any other token, such as "tok_ok", succeeds.`,
        ),
        couponCode: CreateOrderInputSchema.shape.couponCode.describe(
          'Optional coupon code, exact and case-sensitive, such as "WELCOME10".',
        ),
        idempotencyKey: CreateOrderInputSchema.shape.idempotencyKey.describe(
          `Any unique string for this checkout, up to ${MAX_STRING_LENGTH} characters. Reuse it only to retry the same checkout.`,
        ),
      }),
      outputSchema: OrderSchema,
      annotations: { ...WRITE, idempotentHint: false },
    },
    (input) => respond(() => services.orders.create(input)),
  )

  server.registerTool(
    'get_order',
    {
      title: 'Get an order',
      description: [
        'Returns one order by id, with its status ("paid", "shipped" or "canceled"), items and totals.',
        MONEY,
        'Errors: not_found for an unknown order id.',
      ].join(' '),
      inputSchema: z.strictObject({ orderId }),
      outputSchema: OrderSchema,
      annotations: { ...READ_ONLY, idempotentHint: true },
    },
    ({ orderId }) => respond(() => services.orders.get(orderId)),
  )

  server.registerTool(
    'list_orders',
    {
      title: 'List orders',
      description: [
        `Lists orders ordered by id, ${PAGE_SIZE}. Filter with \`status\`.`,
        'Returns { data: Order[], nextCursor }. Pass nextCursor as `cursor` for the next page; it is null on the last page.',
        'Errors: invalid_request for a cursor that is not the id of an order, whatever its status.',
      ].join(' '),
      inputSchema: OrderListInputSchema.extend({
        cursor: OrderListInputSchema.shape.cursor.describe(CURSOR),
        limit: OrderListInputSchema.shape.limit.describe(LIMIT),
        status: OrderListInputSchema.shape.status.describe('Only orders with this status.'),
      }),
      outputSchema: OrderPageSchema,
      annotations: { ...READ_ONLY, idempotentHint: true },
    },
    (input) => respond(() => services.orders.list(input)),
  )

  server.registerTool(
    'cancel_order',
    {
      title: 'Cancel an order',
      description: [
        'Cancels an order with status "paid", returns its stock and returns the order with status "canceled".',
        'Errors: not_found for an unknown order id, order_not_cancelable for an order that is "shipped" or already "canceled".',
        'Canceling twice fails the second time.',
      ].join(' '),
      inputSchema: z.strictObject({ orderId }),
      outputSchema: OrderSchema,
      annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
    },
    ({ orderId }) => respond(() => services.orders.cancel(orderId)),
  )

  return server
}

async function respond<T extends object>(call: () => Promise<T>): Promise<CallToolResult> {
  try {
    const value = await call()
    return {
      content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      structuredContent: { ...value },
    }
  } catch (error) {
    if (isAcmeError(error)) return failure(`${error.code}: ${error.message}`)
    if (isAcmeConnectionError(error)) return failure(error.message)
    console.error(error)
    return failure('internal_error: Internal server error')
  }
}

function failure(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}
