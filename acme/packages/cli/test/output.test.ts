import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AcmeServices } from '@acme/core'
import { money } from '../src/format.ts'
import { cart, exec, order, stubServices } from './helpers.ts'

async function execWith(change: (services: AcmeServices) => void, argv: string[]) {
  const { services } = stubServices()
  change(services)
  return exec(argv, () => services)
}

test('money formats integer cents as dollars', () => {
  assert.equal(money(0), '$0.00')
  assert.equal(money(5), '$0.05')
  assert.equal(money(1250), '$12.50')
  assert.equal(money(123456), '$1234.56')
  assert.equal(money(-250), '-$2.50')
  assert.equal(money(-5), '-$0.05')
})

test('products list prints a table and the next cursor', async () => {
  const { stdout } = await exec(['products', 'list'])
  assert.equal(
    stdout,
    [
      'ID        NAME        CATEGORY  PRICE   STOCK',
      'prod_003  Headphones  audio     $12.50  7',
      'next cursor: prod_003',
      '',
    ].join('\n'),
  )
})

test('orders list has no cursor line on the last page', async () => {
  const { stdout } = await exec(['orders', 'list'])
  assert.equal(
    stdout,
    [
      'ID          STATUS  QTY  TOTAL   CREATED',
      'order_0001  paid    2    $22.50  2026-01-01T00:00:02.000Z',
      '',
    ].join('\n'),
  )
})

test('products get prints key/value lines', async () => {
  const { stdout } = await exec(['products', 'get', 'prod_003'])
  assert.equal(
    stdout,
    [
      'id: prod_003',
      'name: Headphones',
      'description: Over-ear',
      'category: audio',
      'price: $12.50',
      'stock: 7',
      '',
    ].join('\n'),
  )
})

test('carts get prints key/value lines and an items table', async () => {
  const { stdout } = await exec(['carts', 'get', 'cart_0001'])
  assert.equal(
    stdout,
    [
      'id: cart_0001',
      'items: 1',
      'subtotal: $25.00',
      'created: 2026-01-01T00:00:00.000Z',
      'updated: 2026-01-01T00:00:01.000Z',
      '',
      'PRODUCT   QTY  UNIT    TOTAL   NAME',
      'prod_003  2    $12.50  $25.00  Headphones',
      '',
    ].join('\n'),
  )
})

test('orders get prints key/value lines and an items table', async () => {
  const { stdout } = await exec(['orders', 'get', 'order_0001'])
  assert.equal(
    stdout,
    [
      'id: order_0001',
      'status: paid',
      'cart: cart_0001',
      'subtotal: $25.00',
      'discount: $2.50',
      'coupon: WELCOME10',
      'total: $22.50',
      'created: 2026-01-01T00:00:02.000Z',
      'updated: 2026-01-01T00:00:02.000Z',
      '',
      'PRODUCT   QTY  UNIT    TOTAL   NAME',
      'prod_003  2    $12.50  $25.00  Headphones',
      '',
    ].join('\n'),
  )
})

test('an order with no coupon prints a dash', async () => {
  const { stdout } = await execWith(
    (services) => {
      services.orders.get = async () => ({ ...order, couponCode: null, discountCents: 0 })
    },
    ['orders', 'get', 'order_0001'],
  )
  assert.match(stdout, /^discount: \$0\.00\ncoupon: -\n/m)
})

test('an empty page prints no results and an empty cart prints no table', async () => {
  const { stdout: list } = await execWith(
    (services) => {
      services.products.list = async () => ({ data: [], nextCursor: null })
    },
    ['products', 'list', '--q', 'nothing'],
  )
  assert.equal(list, 'no results\n')

  const { stdout: empty } = await execWith(
    (services) => {
      services.carts.get = async () => ({ ...cart, items: [], subtotalCents: 0 })
    },
    ['carts', 'get', 'cart_0001'],
  )
  assert.equal(
    empty,
    [
      'id: cart_0001',
      'items: 0',
      'subtotal: $0.00',
      'created: 2026-01-01T00:00:00.000Z',
      'updated: 2026-01-01T00:00:01.000Z',
      '',
    ].join('\n'),
  )
})

test('reset prints ok', async () => {
  assert.equal((await exec(['reset'])).stdout, 'ok\n')
})
