import {
  AddCartItemInputSchema,
  CATEGORIES,
  CartItemSchema,
  CartSchema,
  COUPONS,
  type Coupon,
  CreateOrderInputSchema,
  ERROR_STATUS,
  type ErrorCode,
  ErrorEnvelopeSchema,
  IdSchema,
  MAX_ITEM_QUANTITY,
  OrderListInputSchema,
  OrderSchema,
  PAGE_LIMIT,
  PAYMENT_TOKEN_DECLINED,
  PRODUCTS,
  ProductListInputSchema,
  ProductSchema,
  pageSchema,
  seedState,
  UpdateCartItemInputSchema,
} from '@acme/core'
import { z } from 'zod'

function couponText({ code, type, value, minSubtotalCents, expiresAt }: Coupon): string {
  // Every coupon with an expiry expired before any clock this service runs on.
  if (expiresAt !== null) return `\`${code}\` is expired`
  const off = type === 'percent' ? `${value}% off, rounded down` : `${value} cents off`
  const minimum = minSubtotalCents > 0 ? ` a subtotal of at least ${minSubtotalCents}` : ''
  return `\`${code}\` takes ${off}${minimum}`
}

const COUPONS_TEXT = `${COUPONS.map(couponText).join('. ')}. Codes are case-sensitive.`
const PAYMENT_TEXT = `\`${PAYMENT_TOKEN_DECLINED}\` is declined. Any other token, such as \`tok_ok\`, succeeds.`
const QUANTITY_TEXT = `1 to ${MAX_ITEM_QUANTITY}.`

const CreateOrderBodySchema = CreateOrderInputSchema.omit({ idempotencyKey: true }).extend({
  cartId: CreateOrderInputSchema.shape.cartId.describe('The cart to check out.'),
  paymentToken: CreateOrderInputSchema.shape.paymentToken.describe(PAYMENT_TEXT),
  couponCode: CreateOrderInputSchema.shape.couponCode.describe(COUPONS_TEXT),
})

/** The schemas of `components.schemas`, by name. Tests check responses against them. */
export const SCHEMAS = {
  Product: ProductSchema,
  ProductPage: pageSchema(ProductSchema),
  CartItem: CartItemSchema,
  Cart: CartSchema,
  Order: OrderSchema,
  OrderPage: pageSchema(OrderSchema),
  AddCartItemInput: AddCartItemInputSchema.extend({
    quantity: AddCartItemInputSchema.shape.quantity.describe(
      `How many to add, ${QUANTITY_TEXT} The line may hold at most ${MAX_ITEM_QUANTITY} in all.`,
    ),
  }),
  UpdateCartItemInput: UpdateCartItemInputSchema.extend({
    quantity: UpdateCartItemInputSchema.shape.quantity.describe(
      `The new quantity, ${QUANTITY_TEXT}`,
    ),
  }),
  CreateOrderInput: CreateOrderBodySchema,
  Ok: z.object({ ok: z.literal(true) }),
  ErrorEnvelope: ErrorEnvelopeSchema,
} satisfies Record<string, z.ZodType>

type SchemaName = keyof typeof SCHEMAS

const SCHEMA_DESCRIPTIONS: Partial<Record<SchemaName, string>> = {
  Product:
    'A product. `stock` is what this key can still buy; a product with stock 0 cannot be bought.',
  ProductPage: 'One page of products. `nextCursor` is null on the last page.',
  CartItem: 'A priced line of a cart or an order.',
  Cart: 'A cart. Prices are the current catalog prices.',
  Order: 'An order. Its items and prices are those of the cart at checkout.',
  OrderPage: 'One page of orders. `nextCursor` is null on the last page.',
  ErrorEnvelope: 'The body of every error. `code` is stable; `message` is for a person.',
}

/** One HTTP operation, as the document describes it. */
interface Operation {
  operationId: string
  method: 'get' | 'post' | 'patch' | 'delete'
  /** The OpenAPI path, with `{name}` parameters. */
  path: string
  summary: string
  description?: string
  /** False for a route that needs no API key. */
  auth?: false
  query?: z.ZodObject
  body?: SchemaName
  idempotencyKey?: true
  status: 200 | 201
  /** The schema of the success body. None means any JSON object. */
  response?: SchemaName
  /** Each error code the route gives, and when. 401 and 413 are added from `auth` and `body`. */
  errors?: [ErrorCode, string][]
}

const LONG_ID: [ErrorCode, string] = [
  'invalid_request',
  'An id in the path is longer than 255 characters.',
]
const BAD_BODY: [ErrorCode, string] = [
  'invalid_request',
  'The body is not a JSON object, or fails its schema.',
]

/** Every operation of the document. Tests hold them to the routes `createApp` serves. */
export const OPERATIONS: Operation[] = [
  {
    operationId: 'health',
    method: 'get',
    path: '/health',
    summary: 'Check that the service is up',
    auth: false,
    status: 200,
    response: 'Ok',
  },
  {
    operationId: 'openapi',
    method: 'get',
    path: '/openapi.json',
    summary: 'Get this OpenAPI document',
    auth: false,
    status: 200,
  },
  {
    operationId: 'products.list',
    method: 'get',
    path: '/v1/products',
    summary: 'List products',
    description: 'Lists the catalog in id order, filtered by `q` and `category`.',
    query: ProductListInputSchema,
    status: 200,
    response: 'ProductPage',
    errors: [
      [
        'invalid_request',
        'A query parameter fails its schema or is unknown, or `cursor` is not the id of a product in this filtered list.',
      ],
    ],
  },
  {
    operationId: 'products.get',
    method: 'get',
    path: '/v1/products/{id}',
    summary: 'Get a product',
    status: 200,
    response: 'Product',
    errors: [LONG_ID, ['not_found', 'No product has this id.']],
  },
  {
    operationId: 'carts.create',
    method: 'post',
    path: '/v1/carts',
    summary: 'Create an empty cart',
    description: 'Takes no body. Each call creates a new cart.',
    status: 201,
    response: 'Cart',
  },
  {
    operationId: 'carts.get',
    method: 'get',
    path: '/v1/carts/{id}',
    summary: 'Get a cart',
    status: 200,
    response: 'Cart',
    errors: [LONG_ID, ['not_found', 'No cart has this id.']],
  },
  {
    operationId: 'carts.addItem',
    method: 'post',
    path: '/v1/carts/{id}/items',
    summary: 'Add a product to a cart',
    description:
      'Adding a product already in the cart adds to its quantity. Stock is checked at checkout, not here. Returns the cart.',
    body: 'AddCartItemInput',
    status: 200,
    response: 'Cart',
    errors: [
      BAD_BODY,
      ['invalid_request', `The line would hold more than ${MAX_ITEM_QUANTITY}.`],
      LONG_ID,
      ['not_found', 'No cart has this id, or no product has `productId`.'],
    ],
  },
  {
    operationId: 'carts.updateItem',
    method: 'patch',
    path: '/v1/carts/{id}/items/{productId}',
    summary: 'Set the quantity of a product in a cart',
    description: 'To remove a product, use `carts.removeItem`. Returns the cart.',
    body: 'UpdateCartItemInput',
    status: 200,
    response: 'Cart',
    errors: [BAD_BODY, LONG_ID, ['not_found', 'No cart has this id, or the product is not in it.']],
  },
  {
    operationId: 'carts.removeItem',
    method: 'delete',
    path: '/v1/carts/{id}/items/{productId}',
    summary: 'Remove a product from a cart',
    description: 'Returns the cart.',
    status: 200,
    response: 'Cart',
    errors: [LONG_ID, ['not_found', 'No cart has this id, or the product is not in it.']],
  },
  {
    operationId: 'orders.create',
    method: 'post',
    path: '/v1/orders',
    summary: 'Check out a cart',
    description: [
      'Creates a `paid` order from the cart, takes its items from stock and empties the cart, which stays usable.',
      'A failed checkout changes nothing.',
      'A repeated `Idempotency-Key` returns the order the first request created, with 201, whatever the body, and changes nothing.',
    ].join(' '),
    body: 'CreateOrderInput',
    idempotencyKey: true,
    status: 201,
    response: 'Order',
    errors: [
      BAD_BODY,
      ['not_found', 'No cart has this id.'],
      ['cart_empty', 'The cart has no items.'],
      ['insufficient_stock', 'A line asks for more than the stock.'],
      ['coupon_invalid', 'The coupon is unknown or expired, or the subtotal is below its minimum.'],
      ['payment_declined', `The payment token is \`${PAYMENT_TOKEN_DECLINED}\`.`],
    ],
  },
  {
    operationId: 'orders.list',
    method: 'get',
    path: '/v1/orders',
    summary: 'List orders',
    description: 'Lists the orders of this key in id order, filtered by `status`.',
    query: OrderListInputSchema,
    status: 200,
    response: 'OrderPage',
    errors: [
      [
        'invalid_request',
        'A query parameter fails its schema or is unknown, or `cursor` is not the id of an order.',
      ],
    ],
  },
  {
    operationId: 'orders.get',
    method: 'get',
    path: '/v1/orders/{id}',
    summary: 'Get an order',
    status: 200,
    response: 'Order',
    errors: [LONG_ID, ['not_found', 'No order has this id.']],
  },
  {
    operationId: 'orders.cancel',
    method: 'post',
    path: '/v1/orders/{id}/cancel',
    summary: 'Cancel a paid order',
    description: 'Takes no body. Sets the status to `canceled` and returns the items to stock.',
    status: 200,
    response: 'Order',
    errors: [
      LONG_ID,
      ['not_found', 'No order has this id.'],
      ['order_not_cancelable', 'The order is `shipped` or already `canceled`.'],
    ],
  },
  {
    operationId: 'reset',
    method: 'post',
    path: '/v1/reset',
    summary: 'Restore the seed data of this key',
    description: 'Takes no body. Deletes its carts and new orders, and restores the stock and ids.',
    status: 200,
    response: 'Ok',
  },
]

const PATH_PARAMS: Record<string, string> = {
  products: 'A product id, such as `prod_001`.',
  carts: 'A cart id from `carts.create`, such as `cart_0001`.',
  orders: 'An order id, such as `order_0001`.',
  items: 'The id of a product in the cart, such as `prod_001`.',
}

const QUERY_PARAMS: Record<string, string> = {
  q: 'Text to find in the name or description, ignoring case, such as `headphones`.',
  category: 'Only products of this category.',
  status: 'Only orders with this status.',
  cursor: 'The `nextCursor` of the previous page. Omit it for the first page.',
  limit: `Items for each page, 1 to ${PAGE_LIMIT.max}.`,
}

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema, ...rest } = z.toJSONSchema(schema, { override: dropSafeIntegerBound })
  return rest
}

function dropSafeIntegerBound({ jsonSchema }: { jsonSchema: { maximum?: number } }): void {
  if (jsonSchema.maximum === Number.MAX_SAFE_INTEGER) delete jsonSchema.maximum
}

function components(): Record<string, unknown> {
  const registry = z.registry<{ id: string }>()
  for (const [id, schema] of Object.entries(SCHEMAS)) registry.add(schema, { id })
  const { schemas } = z.toJSONSchema(registry, {
    uri: (id) => `#/components/schemas/${id}`,
    override: dropSafeIntegerBound,
  })
  return Object.fromEntries(
    Object.entries(schemas).map(([id, { $schema, $id, ...rest }]) => {
      const description = SCHEMA_DESCRIPTIONS[id as SchemaName]
      return [id, description === undefined ? rest : { description, ...rest }]
    }),
  )
}

const ref = (name: SchemaName) => ({ $ref: `#/components/schemas/${name}` })
const json = (schema: unknown) => ({ 'application/json': { schema } })

function errorResponse(errors: [ErrorCode, string][]) {
  return {
    description: errors.map(([code, when]) => `- \`${code}\`: ${when}`).join('\n'),
    content: json(ref('ErrorEnvelope')),
  }
}

function parameters(op: Operation): Record<string, unknown>[] {
  const segments = op.path.split('/')
  const path = segments.flatMap((segment, index) => {
    const name = /^\{(\w+)\}$/.exec(segment)?.[1]
    if (name === undefined) return []
    const description = PATH_PARAMS[segments[index - 1] ?? '']
    return [{ name, in: 'path', required: true, description, schema: jsonSchema(IdSchema) }]
  })
  const query = Object.entries(op.query?.shape ?? {}).map(([name, schema]) => ({
    name,
    in: 'query',
    description: QUERY_PARAMS[name],
    schema: {
      ...jsonSchema(schema),
      ...(name === 'limit' ? { default: PAGE_LIMIT.default } : {}),
    },
  }))
  const header = op.idempotencyKey
    ? [
        {
          name: 'Idempotency-Key',
          in: 'header',
          description:
            'Any string you choose. A repeat of an earlier successful checkout of this API key returns that order and creates nothing.',
          schema: jsonSchema(CreateOrderInputSchema.shape.idempotencyKey),
        },
      ]
    : []
  return [...path, ...query, ...header]
}

function operation(op: Operation): Record<string, unknown> {
  const byStatus = new Map<number, [ErrorCode, string][]>()
  for (const error of op.errors ?? []) {
    const status = ERROR_STATUS[error[0]]
    byStatus.set(status, [...(byStatus.get(status) ?? []), error])
  }
  const responses: Record<string, unknown> = {
    [op.status]: {
      description: 'Success.',
      content: json(op.response === undefined ? { type: 'object' } : ref(op.response)),
    },
  }
  for (const [status, errors] of byStatus) responses[status] = errorResponse(errors)
  if (op.auth !== false) responses[401] = { $ref: '#/components/responses/Unauthorized' }
  if (op.body !== undefined) responses[413] = { $ref: '#/components/responses/TooLarge' }
  const params = parameters(op)
  return {
    operationId: op.operationId,
    summary: op.summary,
    ...(op.description === undefined ? {} : { description: op.description }),
    ...(op.auth === false ? { security: [] } : {}),
    ...(params.length > 0 ? { parameters: params } : {}),
    ...(op.body === undefined
      ? {}
      : { requestBody: { required: true, content: json(ref(op.body)) } }),
    responses,
  }
}

function buildDocument() {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const op of OPERATIONS) paths[op.path] = { ...paths[op.path], [op.method]: operation(op) }
  const products = `${PRODUCTS.length} products, \`${PRODUCTS[0]?.id}\` to \`${PRODUCTS.at(-1)?.id}\``
  const soldOut = PRODUCTS.filter((product) => product.stock === 0).map((p) => `\`${p.id}\``)
  const orders = Object.values(seedState().orders).map((o) => `\`${o.id}\` (${o.status})`)
  return {
    openapi: '3.1.0',
    info: {
      title: 'acme API',
      version: '0.0.0',
      description: [
        'acme is a mock e-commerce service: a product catalog, carts and orders.',
        'Every API key is its own tenant with its own copy of the seed data, and there is no signup.',
        'Money is integer cents in USD (1999 is $19.99).',
        'Bodies are JSON. Inputs are strict: an unknown query or body field is `invalid_request`.',
        'Every error is an `ErrorEnvelope`. An unknown route is 404 `not_found`, and an unexpected fault is 500 `internal_error`.',
        `Seed data: ${products}, in the categories ${CATEGORIES.map((c) => `\`${c}\``).join(', ')}; ${soldOut.join(' and ')} have stock 0. Orders ${orders.join(' and ')}.`,
        '`POST /v1/reset` restores it.',
        'The same operations are also an MCP server (Streamable HTTP) at `/mcp`, with the same key.',
      ].join(' '),
    },
    servers: [{ url: 'http://localhost:8787', description: 'The local server' }],
    security: [{ bearer: [] }],
    paths,
    components: {
      securitySchemes: {
        bearer: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Send `Authorization: Bearer <key>`. A key is `acme_test_` and then one or more letters, digits or `. _ ~ + / -` characters, optionally ending in `=` padding, at most 256 characters in all, such as `acme_test_demo`.',
        },
      },
      responses: {
        Unauthorized: errorResponse([['unauthorized', 'The API key is missing or invalid.']]),
        TooLarge: errorResponse([['invalid_request', 'The body is larger than 64 KiB.']]),
      },
      schemas: components(),
    },
  }
}

/** The OpenAPI 3.1 document of the HTTP API, built once. */
export const OPENAPI = buildDocument()

/** The document as the committed `openapi.json` holds it: formatted as Biome formats JSON. */
export function openapiJson(): string {
  return `${formatJson(OPENAPI, '', 0)}\n`
}

const LINE_WIDTH = 100

/**
 * Two-space JSON in which an array of primitives that fits on its line stays on one line. `taken`
 * counts the characters of that line around the value, its trailing comma included.
 */
function formatJson(value: unknown, indent: string, taken: number): string {
  if (typeof value !== 'object' || value === null) return JSON.stringify(value)
  const isArray = Array.isArray(value)
  const entries = (isArray ? value.map((item) => [null, item]) : Object.entries(value)).filter(
    ([, item]) => item !== undefined,
  )
  if (entries.length === 0) return isArray ? '[]' : '{}'
  if (isArray && entries.every(([, item]) => typeof item !== 'object' || item === null)) {
    const line = `[${entries.map(([, item]) => JSON.stringify(item)).join(', ')}]`
    if (taken + line.length <= LINE_WIDTH) return line
  }
  const inner = `${indent}  `
  const lines = entries.map(([key, item], index) => {
    const head = `${inner}${key === null ? '' : `${JSON.stringify(key)}: `}`
    const comma = index < entries.length - 1 ? 1 : 0
    return head + formatJson(item, inner, head.length + comma)
  })
  return `${isArray ? '[' : '{'}\n${lines.join(',\n')}\n${indent}${isArray ? ']' : '}'}`
}
