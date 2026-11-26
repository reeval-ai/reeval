import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { z } from 'zod'
import {
  AcmeConnectionError,
  AcmeError,
  AddCartItemInputSchema,
  CATEGORIES,
  CreateOrderInputSchema,
  ErrorEnvelopeSchema,
  errorFromEnvelope,
  IdSchema,
  isAcmeConnectionError,
  isAcmeError,
  OrderListInputSchema,
  PRODUCTS,
  ProductListInputSchema,
  seedState,
  TenantStateSchema,
  UpdateCartItemInputSchema,
} from '../src/index.ts'

test('AcmeError carries its code and status and makes an envelope', () => {
  const error = new AcmeError('not_found', 'Product prod_9 not found')
  assert.equal(error.status, 404)
  assert.ok(isAcmeError(error))
  assert.deepEqual(error.toEnvelope(), {
    error: { code: 'not_found', message: 'Product prod_9 not found' },
  })
  assert.ok(ErrorEnvelopeSchema.safeParse(error.toEnvelope()).success)
})

test('isAcmeConnectionError knows a connection error, also from another copy of the package', () => {
  const cause = new Error('connect ECONNREFUSED')
  const error = new AcmeConnectionError('GET http://x.test/v1/products failed', { cause })
  assert.equal(error.cause, cause)
  assert.equal(error.status, undefined)
  assert.ok(isAcmeConnectionError(error))
  assert.ok(isAcmeConnectionError(Object.assign(new Error('x'), { name: 'AcmeConnectionError' })))
  assert.ok(!isAcmeConnectionError(new AcmeError('not_found', 'x')))
  assert.ok(!isAcmeError(error))
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
})

test('CATEGORIES is the categories of the seed products, in catalog order', () => {
  assert.deepEqual([...new Set(PRODUCTS.map((product) => product.category))], [...CATEGORIES])
})

test('the input schemas refuse unknown fields', () => {
  const inputs: [z.ZodType, Record<string, unknown>][] = [
    [ProductListInputSchema, { extra: 1 }],
    [AddCartItemInputSchema, { productId: 'prod_001', quantity: 1, extra: 1 }],
    [UpdateCartItemInputSchema, { quantity: 1, extra: 1 }],
    [CreateOrderInputSchema, { cartId: 'cart_0001', paymentToken: 'tok_ok', extra: 1 }],
    [OrderListInputSchema, { extra: 1 }],
  ]
  for (const [schema, input] of inputs) {
    const issues = schema.safeParse(input).error?.issues
    assert.deepEqual(
      issues?.map((issue) => issue.message),
      ['Unrecognized key: "extra"'],
    )
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
