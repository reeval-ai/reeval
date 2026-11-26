import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { z } from 'zod'
import {
  AcmeError,
  AddCartItemInputSchema,
  CATEGORIES,
  CategorySchema,
  COUPONS,
  CreateOrderInputSchema,
  ERROR_STATUS,
  ErrorEnvelopeSchema,
  errorFromEnvelope,
  IdSchema,
  isAcmeError,
  OrderListInputSchema,
  OrderListQuerySchema,
  PRODUCTS,
  ProductListInputSchema,
  ProductListQuerySchema,
  ProductSchema,
  seedState,
  TenantStateSchema,
  UpdateCartItemInputSchema,
} from '../src/index.ts'

test('every error code maps to the status of the plan', () => {
  assert.deepEqual(ERROR_STATUS, {
    unauthorized: 401,
    invalid_request: 400,
    not_found: 404,
    insufficient_stock: 409,
    cart_empty: 409,
    payment_declined: 402,
    coupon_invalid: 422,
    order_not_cancelable: 409,
    internal_error: 500,
  })
})

test('AcmeError carries its code and status and makes an envelope', () => {
  const error = new AcmeError('not_found', 'Product prod_9 not found')
  assert.equal(error.status, 404)
  assert.ok(isAcmeError(error))
  assert.deepEqual(error.toEnvelope(), {
    error: { code: 'not_found', message: 'Product prod_9 not found' },
  })
  assert.ok(ErrorEnvelopeSchema.safeParse(error.toEnvelope()).success)
})

test('errorFromEnvelope rebuilds an error, or returns null', () => {
  const error = errorFromEnvelope(402, { error: { code: 'payment_declined', message: 'no' } })
  assert.equal(error?.code, 'payment_declined')
  assert.equal(error?.status, 402)
  assert.equal(errorFromEnvelope(500, { oops: true }), null)
})

test('the seed has 24 products in 4 categories, two without stock', () => {
  assert.equal(PRODUCTS.length, 24)
  assert.equal(PRODUCTS[0]?.id, 'prod_001')
  assert.equal(PRODUCTS[23]?.id, 'prod_024')
  assert.equal(new Set(PRODUCTS.map((product) => product.category)).size, 4)
  assert.equal(PRODUCTS.filter((product) => product.stock === 0).length, 2)
  assert.deepEqual(COUPONS, [
    { code: 'WELCOME10', type: 'percent', value: 10, minSubtotalCents: 0, expiresAt: null },
    { code: 'SAVE5', type: 'fixed', value: 500, minSubtotalCents: 5000, expiresAt: null },
    {
      code: 'EXPIRED20',
      type: 'percent',
      value: 20,
      minSubtotalCents: 0,
      expiresAt: '2020-01-01T00:00:00.000Z',
    },
  ])
})

test('CATEGORIES is the categories of the seed products, and the category schema', () => {
  assert.deepEqual(CATEGORIES, ['audio', 'computing', 'home', 'outdoors'])
  assert.deepEqual([...new Set(PRODUCTS.map((product) => product.category))], [...CATEGORIES])
  assert.deepEqual(CategorySchema.options, [...CATEGORIES])
  assert.equal(ProductSchema.shape.category, CategorySchema)
  assert.equal(ProductListInputSchema.shape.category.unwrap(), CategorySchema)
})

test('the input schemas refuse unknown fields', () => {
  const inputs: [z.ZodType, Record<string, unknown>][] = [
    [ProductListInputSchema, { extra: 1 }],
    [ProductListQuerySchema, { extra: '1' }],
    [AddCartItemInputSchema, { productId: 'prod_001', quantity: 1, extra: 1 }],
    [UpdateCartItemInputSchema, { quantity: 1, extra: 1 }],
    [CreateOrderInputSchema, { cartId: 'cart_0001', paymentToken: 'tok_ok', extra: 1 }],
    [OrderListInputSchema, { extra: 1 }],
    [OrderListQuerySchema, { extra: '1' }],
  ]
  for (const [schema, input] of inputs) {
    const issues = schema.safeParse(input).error?.issues
    assert.deepEqual(
      issues?.map((issue) => issue.message),
      ['Unrecognized key: "extra"'],
    )
  }
})

test('a query string limit takes decimal digits only', () => {
  for (const schema of [ProductListQuerySchema, OrderListQuerySchema]) {
    assert.deepEqual(schema.parse({ limit: '5' }), { limit: 5 })
    assert.deepEqual(schema.parse({ limit: '050' }), { limit: 50 })
    for (const limit of ['1e1', '0x10', '5.0', ' 5', '5 ', '', '+5', '-5', '٥']) {
      const issues = schema.safeParse({ limit }).error?.issues
      assert.deepEqual(
        issues?.map((issue) => [issue.path.join('.'), issue.message]),
        [['limit', 'Expected an integer in decimal digits, such as 10']],
        limit,
      )
    }
    for (const limit of ['0', '51']) assert.equal(schema.safeParse({ limit }).success, false)
  }
})

test('IdSchema takes 1 to 255 characters', () => {
  assert.equal(IdSchema.safeParse('x'.repeat(255)).success, true)
  assert.equal(IdSchema.safeParse('x'.repeat(256)).success, false)
  assert.equal(IdSchema.safeParse('').success, false)
})

test('the seed state is valid JSON data and a fresh copy each time', () => {
  const state = seedState()
  assert.ok(TenantStateSchema.safeParse(state).success)
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state)
  state.counters.cart = 5
  assert.equal(seedState().counters.cart, 0)
  assert.deepEqual(
    Object.values(state.orders).map((order) => order.status),
    ['paid', 'shipped'],
  )
})
