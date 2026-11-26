import { evictDurableObject, listDurableObjectIds } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import type { Cart, Order, Page, Product } from '@acme/core'
import { expect, test } from 'vitest'
import { freshKey, v1, workerFetch } from './helpers.ts'

test('GET /health answers without creating an object', async () => {
  const before = (await listDurableObjectIds(env.TENANT)).length
  const res = await workerFetch('http://acme.test/health')
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true })
  expect((await listDurableObjectIds(env.TENANT)).length).toBe(before)
})

test('GET /openapi.json answers without creating an object, with or without a key', async () => {
  const before = (await listDurableObjectIds(env.TENANT)).length
  const keyed: HeadersInit = { authorization: `Bearer ${freshKey('openapi')}` }
  for (const headers of [{}, keyed]) {
    const res = await workerFetch('http://acme.test/openapi.json', { headers })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { openapi: string }).openapi).toBe('3.1.0')
  }
  expect((await listDurableObjectIds(env.TENANT)).length).toBe(before)
})

test('a missing or bad key gets 401 without creating an object', async () => {
  const before = (await listDurableObjectIds(env.TENANT)).length
  for (const [path, headers] of [
    ['/v1/products', {}],
    ['/v1/products', { authorization: 'Bearer nope' }],
    ['/mcp', {}],
    ['/mcp', { authorization: 'Bearer sk_live_x' }],
  ] as const) {
    const res = await workerFetch(`http://acme.test${path}`, { headers })
    expect(res.status, path).toBe(401)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('unauthorized')
  }
  const missing = await workerFetch('http://acme.test/nope', {
    headers: { authorization: `Bearer ${freshKey('nf')}` },
  })
  expect(missing.status).toBe(404)
  expect((await listDurableObjectIds(env.TENANT)).length).toBe(before)
})

test('a full flow through /v1: products, cart, checkout, read back, cancel', async () => {
  const key = freshKey('flow')
  const products = await v1<Page<Product>>(key, 'GET', '/v1/products?limit=5')
  expect(products.status).toBe(200)
  expect(products.body.data).toHaveLength(5)

  const cart = await v1<Cart>(key, 'POST', '/v1/carts')
  expect(cart.status).toBe(201)
  const added = await v1<Cart>(key, 'POST', `/v1/carts/${cart.body.id}/items`, {
    productId: 'prod_003',
    quantity: 2,
  })
  expect(added.status).toBe(200)
  expect(added.body.items).toHaveLength(1)

  const order = await v1<Order>(key, 'POST', '/v1/orders', {
    cartId: cart.body.id,
    paymentToken: 'tok_ok',
  })
  expect(order.status).toBe(201)
  expect(order.body.status).toBe('paid')

  const read = await v1<Order>(key, 'GET', `/v1/orders/${order.body.id}`)
  expect(read.body).toEqual(order.body)

  const canceled = await v1<Order>(key, 'POST', `/v1/orders/${order.body.id}/cancel`)
  expect(canceled.status).toBe(200)
  expect(canceled.body.status).toBe('canceled')
})

test('state persists between requests and across an eviction of the object', async () => {
  const key = freshKey('persist')
  const cart = await v1<Cart>(key, 'POST', '/v1/carts')
  await v1(key, 'POST', `/v1/carts/${cart.body.id}/items`, { productId: 'prod_003', quantity: 3 })

  await evictDurableObject(env.TENANT.get(env.TENANT.idFromName(key)))

  const after = await v1<Cart>(key, 'GET', `/v1/carts/${cart.body.id}`)
  expect(after.status).toBe(200)
  expect(after.body.items).toEqual([
    expect.objectContaining({ productId: 'prod_003', quantity: 3 }),
  ])
  const next = await v1<Cart>(key, 'POST', '/v1/carts')
  expect(next.body.id).not.toBe(cart.body.id)
})

test('two keys are isolated, and reset restores only the caller seed', async () => {
  const a = freshKey('iso_a')
  const b = freshKey('iso_b')
  const cartA = await v1<Cart>(a, 'POST', '/v1/carts')
  const cartB = await v1<Cart>(b, 'POST', '/v1/carts')
  expect(cartA.body.id).toBe(cartB.body.id)
  await v1(a, 'POST', `/v1/carts/${cartA.body.id}/items`, { productId: 'prod_003', quantity: 1 })

  const otherView = await v1<Cart>(b, 'GET', `/v1/carts/${cartB.body.id}`)
  expect(otherView.body.items).toEqual([])

  expect((await v1(a, 'POST', '/v1/reset')).status).toBe(200)
  expect((await v1(a, 'GET', `/v1/carts/${cartA.body.id}`)).status).toBe(404)
  expect((await v1(b, 'GET', `/v1/carts/${cartB.body.id}`)).status).toBe(200)
})

test('a percent-encoded tenant path reaches the tenant, as the app routes it', async () => {
  const key = freshKey('encoded')
  const res = await workerFetch('http://acme.test/%761/products?limit=1', {
    headers: { authorization: `Bearer ${key}` },
  })
  expect(res.status).toBe(200)
  expect(((await res.json()) as Page<Product>).data).toHaveLength(1)
})

test("an object serves its own key's state whatever key the request carries", async () => {
  const owner = freshKey('owner')
  const intruder = freshKey('intruder')
  const cart = await v1<Cart>(owner, 'POST', '/v1/carts')
  await v1(owner, 'POST', `/v1/carts/${cart.body.id}/items`, { productId: 'prod_003', quantity: 1 })

  const res = await env.TENANT.get(env.TENANT.idFromName(owner)).fetch(
    `http://acme.test/v1/carts/${cart.body.id}`,
    { headers: { authorization: `Bearer ${intruder}` } },
  )
  expect(res.status).toBe(200)
  expect(((await res.json()) as Cart).items).toHaveLength(1)
  expect((await v1(intruder, 'GET', `/v1/carts/${cart.body.id}`)).status).toBe(404)
})

test('concurrent requests for one key do not lose updates', async () => {
  const key = freshKey('race')
  const results = await Promise.all(
    Array.from({ length: 10 }, () => v1<Cart>(key, 'POST', '/v1/carts')),
  )
  expect(new Set(results.map((r) => r.body.id)).size).toBe(10)
})
