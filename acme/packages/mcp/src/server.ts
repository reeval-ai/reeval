import {
  type AcmeServices,
  AddCartItemInputSchema,
  CATEGORIES,
  CartSchema,
  CreateOrderInputSchema,
  IdSchema,
  isAcmeError,
  OrderListInputSchema,
  OrderSchema,
  ProductListInputSchema,
  ProductSchema,
  pageSchema,
  UpdateCartItemInputSchema,
} from '@acme/core'
import type { CallToolResult, StandardSchemaWithJSON } from '@modelcontextprotocol/server'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

/** The names of the tools `buildServer` registers. */
export const TOOL_NAMES = [
  'search_products',
  'get_product',
  'create_cart',
  'get_cart',
  'add_cart_item',
  'update_cart_item',
  'remove_cart_item',
  'checkout',
  'get_order',
  'list_orders',
  'cancel_order',
] as const

/** The name of one tool of the acme MCP server. */
export type ToolName = (typeof TOOL_NAMES)[number]

const cartId = IdSchema.describe('Cart id from create_cart, such as "cart_0001".')
const orderId = IdSchema.describe('Order id from checkout or list_orders, such as "order_0001".')
const productId = IdSchema.describe('Product id from search_products, such as "prod_003".')
const CURSOR = 'nextCursor of the previous page. Omit it for the first page.'
const LIMIT = 'Items for each page, 1 to 50. Defaults to 10.'

const ProductPageSchema = compact(pageSchema(ProductSchema))
const OrderPageSchema = compact(pageSchema(OrderSchema))
const CompactCartSchema = compact(CartSchema)
const CompactOrderSchema = compact(OrderSchema)
const CompactProductSchema = compact(ProductSchema)

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const

const MONEY = 'Money is integer cents in USD (1999 is $19.99).'

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
        'Lists products of the acme catalog, 10 by default and at most 50 for each page, ordered by id.',
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
      outputSchema: CompactProductSchema,
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
      outputSchema: CompactCartSchema,
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
      outputSchema: CompactCartSchema,
      annotations: { ...READ_ONLY, idempotentHint: true },
    },
    ({ cartId }) => respond(() => services.carts.get(cartId)),
  )

  server.registerTool(
    'add_cart_item',
    {
      title: 'Add a product to a cart',
      description: [
        'Adds `quantity` (1 to 99) of a product to a cart and returns the updated cart.',
        'Adding a product that is already in the cart adds to its quantity; use update_cart_item to set the quantity instead.',
        'Stock is checked at checkout, not here.',
        'A cart line holds at most 99: an add that would take it past 99 changes nothing and fails with invalid_request, such as "invalid_request: quantity: cart cart_0001 would hold 100 of prod_003, the most is 99".',
        'Errors: not_found for an unknown cart or product.',
        'Chain: create_cart, then add_cart_item for each product, then checkout.',
      ].join(' '),
      inputSchema: z.strictObject({
        cartId,
        productId,
        quantity: AddCartItemInputSchema.shape.quantity.describe('How many to add, 1 to 99.'),
      }),
      outputSchema: CompactCartSchema,
      annotations: { ...WRITE, idempotentHint: false },
    },
    ({ cartId, ...input }) => respond(() => services.carts.addItem(cartId, input)),
  )

  server.registerTool(
    'update_cart_item',
    {
      title: 'Set the quantity of a cart item',
      description: [
        'Sets the quantity (1 to 99) of a product already in a cart and returns the updated cart.',
        'Use remove_cart_item to take a product out.',
        'Errors: not_found for an unknown cart or a product that is not in the cart.',
      ].join(' '),
      inputSchema: z.strictObject({
        cartId,
        productId,
        quantity: UpdateCartItemInputSchema.shape.quantity.describe('The new quantity, 1 to 99.'),
      }),
      outputSchema: CompactCartSchema,
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
      outputSchema: CompactCartSchema,
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
        'Coupons: "WELCOME10" takes 10% off, "SAVE5" takes 500 cents off a subtotal of at least 5000, and "EXPIRED20" is expired.',
        'Pass an `idempotencyKey` to make a retry safe: a repeated key returns the first order and creates nothing.',
        'Errors: not_found (unknown cart), cart_empty, insufficient_stock, coupon_invalid (unknown or expired code, or minimum spend not met), payment_declined.',
        'A failed checkout changes nothing, so fix the cause (for example update_cart_item, another couponCode or none) and call checkout again.',
        'Chain: create_cart, add_cart_item, then checkout; read the result with get_order.',
      ].join(' '),
      inputSchema: CreateOrderInputSchema.extend({
        cartId,
        paymentToken: CreateOrderInputSchema.shape.paymentToken.describe(
          '"tok_ok" succeeds; "tok_declined" is declined with payment_declined.',
        ),
        couponCode: CreateOrderInputSchema.shape.couponCode.describe(
          'Optional coupon code, exact and case-sensitive, such as "WELCOME10".',
        ),
        idempotencyKey: CreateOrderInputSchema.shape.idempotencyKey.describe(
          'Any unique string for this checkout, up to 255 characters. Reuse it only to retry the same checkout.',
        ),
      }),
      outputSchema: CompactOrderSchema,
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
      outputSchema: CompactOrderSchema,
      annotations: { ...READ_ONLY, idempotentHint: true },
    },
    ({ orderId }) => respond(() => services.orders.get(orderId)),
  )

  server.registerTool(
    'list_orders',
    {
      title: 'List orders',
      description: [
        'Lists orders ordered by id, 10 by default and at most 50 for each page. Filter with `status`.',
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
      outputSchema: CompactOrderSchema,
      annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
    },
    ({ orderId }) => respond(() => services.orders.cancel(orderId)),
  )

  return server
}

/**
 * The schema with the JSON Schema that clients receive made compact: a date-time is a plain string
 * with a description, and an integer loses the safe-integer maximum. Validation stays the schema's.
 */
function compact<S extends StandardSchemaWithJSON>(
  schema: S,
): StandardSchemaWithJSON<
  StandardSchemaWithJSON.InferInput<S>,
  StandardSchemaWithJSON.InferOutput<S>
> {
  const standard = schema['~standard']
  return {
    '~standard': {
      ...standard,
      jsonSchema: {
        input: (options) => compactJson(standard.jsonSchema.input(options)),
        output: (options) => compactJson(standard.jsonSchema.output(options)),
      },
    },
  }
}

function compactJson<T>(node: T): T {
  if (Array.isArray(node)) {
    for (const item of node) compactJson(item)
  } else if (typeof node === 'object' && node !== null) {
    const record = node as Record<string, unknown>
    if (record.type === 'string' && record.format === 'date-time') {
      delete record.format
      delete record.pattern
      record.description ??= 'ISO 8601 UTC time'
    }
    if (record.type === 'integer' && record.maximum === Number.MAX_SAFE_INTEGER) {
      delete record.maximum
    }
    for (const value of Object.values(record)) compactJson(value)
  }
  return node
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
    // The stdio bin's SDK throws this for an unreachable server; its message names only the URL.
    if (error instanceof Error && error.name === 'AcmeConnectionError')
      return failure(error.message)
    console.error(error)
    return failure('internal_error: Internal server error')
  }
}

function failure(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}
