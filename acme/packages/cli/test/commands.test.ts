import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cart, order, orderPage, product, productPage } from '@acme/core/testing'
import { exec } from './helpers.ts'

const calls = [
  {
    name: 'products list',
    argv: ['products', 'list'],
    call: { method: 'products.list', args: [{}] },
    data: productPage,
  },
  {
    name: 'products list with options',
    argv: [
      'products',
      'list',
      '--q',
      'phone',
      '--category',
      'audio',
      '--limit',
      '5',
      '--cursor',
      'prod_001',
    ],
    call: {
      method: 'products.list',
      args: [{ q: 'phone', category: 'audio', limit: 5, cursor: 'prod_001' }],
    },
    data: productPage,
  },
  {
    name: 'products get',
    argv: ['products', 'get', 'prod_003'],
    call: { method: 'products.get', args: ['prod_003'] },
    data: product,
  },
  {
    name: 'carts create',
    argv: ['carts', 'create'],
    call: { method: 'carts.create', args: [] },
    data: cart,
  },
  {
    name: 'carts get',
    argv: ['carts', 'get', 'cart_0001'],
    call: { method: 'carts.get', args: ['cart_0001'] },
    data: cart,
  },
  {
    name: 'carts add defaults the quantity to 1',
    argv: ['carts', 'add', 'cart_0001', 'prod_003'],
    call: { method: 'carts.addItem', args: ['cart_0001', { productId: 'prod_003', quantity: 1 }] },
    data: cart,
  },
  {
    name: 'carts add with a quantity',
    argv: ['carts', 'add', 'cart_0001', 'prod_003', '--quantity', '3'],
    call: { method: 'carts.addItem', args: ['cart_0001', { productId: 'prod_003', quantity: 3 }] },
    data: cart,
  },
  {
    name: 'carts update',
    argv: ['carts', 'update', 'cart_0001', 'prod_003', '--quantity', '4'],
    call: { method: 'carts.updateItem', args: ['cart_0001', 'prod_003', { quantity: 4 }] },
    data: cart,
  },
  {
    name: 'carts remove',
    argv: ['carts', 'remove', 'cart_0001', 'prod_003'],
    call: { method: 'carts.removeItem', args: ['cart_0001', 'prod_003'] },
    data: cart,
  },
  {
    name: 'orders create',
    argv: ['orders', 'create', '--cart', 'cart_0001', '--payment-token', 'tok_ok'],
    call: { method: 'orders.create', args: [{ cartId: 'cart_0001', paymentToken: 'tok_ok' }] },
    data: order,
  },
  {
    name: 'orders create with a coupon and an idempotency key',
    argv: [
      'orders',
      'create',
      '--cart',
      'cart_0001',
      '--payment-token',
      'tok_ok',
      '--coupon',
      'WELCOME10',
      '--idempotency-key',
      'k1',
    ],
    call: {
      method: 'orders.create',
      args: [
        {
          cartId: 'cart_0001',
          paymentToken: 'tok_ok',
          couponCode: 'WELCOME10',
          idempotencyKey: 'k1',
        },
      ],
    },
    data: order,
  },
  {
    name: 'orders list',
    argv: ['orders', 'list'],
    call: { method: 'orders.list', args: [{}] },
    data: orderPage,
  },
  {
    name: 'orders list with options',
    argv: ['orders', 'list', '--status', 'paid', '--limit', '2', '--cursor', 'order_0001'],
    call: {
      method: 'orders.list',
      args: [{ status: 'paid', limit: 2, cursor: 'order_0001' }],
    },
    data: orderPage,
  },
  {
    name: 'orders get',
    argv: ['orders', 'get', 'order_0001'],
    call: { method: 'orders.get', args: ['order_0001'] },
    data: order,
  },
  {
    name: 'orders cancel',
    argv: ['orders', 'cancel', 'order_0001'],
    call: { method: 'orders.cancel', args: ['order_0001'] },
    data: { ...order, status: 'canceled' },
  },
  { name: 'reset', argv: ['reset'], call: { method: 'reset', args: [] }, data: { ok: true } },
]

for (const { name, argv, call, data } of calls) {
  test(`${name}: calls the service and prints JSON with --json`, async () => {
    const result = await exec(['--json', ...argv])
    assert.equal(result.code, 0)
    assert.deepEqual(result.calls, [call])
    assert.equal(result.stdout, `${JSON.stringify(data, null, 2)}\n`)
    assert.equal(result.stderr, '')
  })

  test(`${name}: prints plain text by default and accepts --json last`, async () => {
    const plain = await exec(argv)
    assert.equal(plain.code, 0)
    assert.deepEqual(plain.calls, [call])
    assert.equal(plain.stderr, '')
    assert.ok(plain.stdout.endsWith('\n'))
    assert.doesNotMatch(plain.stdout, /^[{[]/)

    const last = await exec([...argv, '--json'])
    assert.equal(last.stdout, `${JSON.stringify(data, null, 2)}\n`)
  })
}
