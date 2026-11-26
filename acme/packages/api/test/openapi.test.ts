import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { memoryStoresByKey } from '@acme/core'
import { createApp } from '../src/app.ts'
import { openapiJson, SCHEMAS } from '../src/openapi.ts'

interface Response {
  $ref?: string
  description: string
  content?: { 'application/json': { schema: { $ref?: string } } }
}
interface Parameter {
  name: string
  in: string
  required?: boolean
  schema: object
}
interface Operation {
  operationId: string
  summary: string
  parameters?: Parameter[]
  requestBody?: object
  responses: Record<string, Response>
}
interface Document {
  openapi: string
  info: { title: string; version: string; description: string }
  servers: { url: string }[]
  paths: Record<string, Record<string, Operation>>
  components: { responses: Record<string, Response> }
}

const doc: Document = JSON.parse(openapiJson())
const KEY = 'acme_test_openapi'
const LONG_ID = 'x'.repeat(256)

const operations = Object.entries(doc.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, operation]) => ({ path, method, operation })),
)

function resolveResponse(response: Response): Response {
  if (response.$ref === undefined) return response
  const found = doc.components.responses[response.$ref.replace('#/components/responses/', '')]
  assert.ok(found, response.$ref)
  return found
}

/** The error codes a response lists, one `- \`code\`: when` line each. */
function codesOf(response: Response): string[] {
  return [...response.description.matchAll(/^- `(\w+)`:/gm)].map((match) => match[1] ?? '')
}

function operationFor(method: string, url: string) {
  const path = url.split('?')[0] ?? ''
  const matches = operations.filter(
    (entry) =>
      entry.method === method.toLowerCase() &&
      new RegExp(`^${entry.path.replace(/\{\w+\}/g, '[^/]+')}$`).test(path),
  )
  const [match] = matches
  assert.ok(match && matches.length === 1, `${method} ${url} matches one operation`)
  return match.operation
}

test('the document lists exactly the routes the app serves', () => {
  const app = createApp({ storeForKey: memoryStoresByKey() })
  const served = app.routes
    .filter((route) => !route.path.endsWith('*') && route.path !== '/mcp')
    .map((route) => `${route.method} ${route.path.replace(/:(\w+)/g, '{$1}')}`)
  const described = operations.map((entry) => `${entry.method.toUpperCase()} ${entry.path}`)
  assert.deepEqual(described.toSorted(), served.toSorted())
})

test('real responses have a status and code the document lists, and fit its schemas', async () => {
  const app = createApp({ storeForKey: memoryStoresByKey() })
  const seen = new Set<string>()

  async function call(
    method: string,
    url: string,
    options: { body?: unknown; raw?: string; key?: string | null; idempotencyKey?: string } = {},
  ) {
    const { body, raw, key = KEY, idempotencyKey } = options
    const res = await app.request(url, {
      method,
      headers: {
        ...(key === null ? {} : { authorization: `Bearer ${key}` }),
        ...(idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey }),
        'content-type': 'application/json',
      },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
    const json: { id: string; error?: { code: string } } = JSON.parse(await res.text())
    const operation = operationFor(method, url)
    const declared = operation.responses[String(res.status)]
    assert.ok(declared, `${operation.operationId} declares ${res.status}`)
    const response = resolveResponse(declared)
    const code = json.error?.code ?? ''
    if (code !== '') {
      assert.ok(codesOf(response).includes(code), `${operation.operationId} ${res.status} ${code}`)
    }
    const name = response.content?.['application/json'].schema.$ref?.replace(
      '#/components/schemas/',
      '',
    )
    if (name !== undefined) {
      assert.ok(name in SCHEMAS, name)
      const schema = SCHEMAS[name as keyof typeof SCHEMAS]
      assert.deepEqual(
        schema.parse(json),
        json,
        `${operation.operationId} ${res.status} is ${name}`,
      )
    }
    seen.add(`${operation.operationId} ${res.status} ${code}`)
    return json
  }

  for (const { path, method, operation } of operations) {
    const url = path.replace(/\{\w+\}/g, 'x')
    if (operation.responses['401']) await call(method, url, { key: null })
    if (operation.requestBody) await call(method, url, { raw: JSON.stringify('x'.repeat(65536)) })
  }

  await call('GET', '/health', { key: null })
  await call('GET', '/openapi.json', { key: null })

  await call('GET', '/v1/products?category=audio&limit=2')
  await call('GET', '/v1/products?limit=0')
  await call('GET', '/v1/products?cursor=prod_999')
  await call('GET', '/v1/products/prod_001')
  await call('GET', '/v1/products/prod_999')
  await call('GET', `/v1/products/${LONG_ID}`)

  const cart = await call('POST', '/v1/carts')
  await call('GET', `/v1/carts/${cart.id}`)
  await call('GET', '/v1/carts/cart_9999')
  await call('GET', `/v1/carts/${LONG_ID}`)

  const items = `/v1/carts/${cart.id}/items`
  await call('POST', items, { body: { productId: 'prod_003', quantity: 2 } })
  await call('POST', items, { body: { productId: 'prod_003', quantity: 98 } })
  await call('POST', items, { body: { productId: 'prod_003', quantity: 0 } })
  await call('POST', items, { raw: 'not json' })
  await call('POST', items, { body: { productId: 'prod_999', quantity: 1 } })
  await call('POST', '/v1/carts/cart_9999/items', { body: { productId: 'prod_003', quantity: 1 } })
  await call('POST', `/v1/carts/${LONG_ID}/items`, { body: { productId: 'prod_003', quantity: 1 } })

  await call('PATCH', `${items}/prod_003`, { body: { quantity: 3 } })
  await call('PATCH', `${items}/prod_003`, { body: { quantity: 100 } })
  await call('PATCH', `${items}/prod_999`, { body: { quantity: 1 } })
  await call('PATCH', `${items}/${LONG_ID}`, { body: { quantity: 1 } })

  const other = await call('POST', '/v1/carts')
  await call('POST', `/v1/carts/${other.id}/items`, {
    body: { productId: 'prod_001', quantity: 1 },
  })
  await call('DELETE', `/v1/carts/${other.id}/items/prod_001`)
  await call('DELETE', `/v1/carts/${other.id}/items/prod_001`)
  await call('DELETE', `/v1/carts/${other.id}/items/${LONG_ID}`)

  const soldOut = await call('POST', '/v1/carts')
  await call('POST', `/v1/carts/${soldOut.id}/items`, {
    body: { productId: 'prod_005', quantity: 1 },
  })

  const checkout = (body: object, idempotencyKey?: string) =>
    call('POST', '/v1/orders', { body: { paymentToken: 'tok_ok', ...body }, idempotencyKey })
  await checkout({})
  await checkout({ cartId: 'cart_9999' })
  await checkout({ cartId: other.id })
  await checkout({ cartId: soldOut.id })
  await checkout({ cartId: cart.id, couponCode: 'EXPIRED20' })
  await checkout({ cartId: cart.id, paymentToken: 'tok_declined' })
  const order = await checkout({ cartId: cart.id, couponCode: 'WELCOME10' }, 'checkout-1')
  assert.deepEqual(await checkout({ cartId: cart.id }, 'checkout-1'), order)

  await call('GET', '/v1/orders?status=paid')
  await call('GET', '/v1/orders?status=lost')
  await call('GET', `/v1/orders/${order.id}`)
  await call('GET', '/v1/orders/order_9999')
  await call('GET', `/v1/orders/${LONG_ID}`)

  await call('POST', `/v1/orders/${order.id}/cancel`)
  await call('POST', `/v1/orders/${order.id}/cancel`)
  await call('POST', '/v1/orders/order_9999/cancel')
  await call('POST', `/v1/orders/${LONG_ID}/cancel`)

  await call('POST', '/v1/reset')

  for (const { operation } of operations) {
    for (const [status, declared] of Object.entries(operation.responses)) {
      const codes = Number(status) >= 400 ? codesOf(resolveResponse(declared)) : ['']
      for (const code of codes) {
        const key = `${operation.operationId} ${status} ${code}`
        assert.ok(seen.has(key), `no request produced ${key}`)
      }
    }
  }
})

test('GET /openapi.json serves the document with no key', async () => {
  const app = createApp({ storeForKey: memoryStoresByKey() })
  const res = await app.request('/openapi.json')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /^application\/json/)
  assert.deepEqual(await res.json(), doc)
})

test('the committed openapi.json is what the code generates', () => {
  const committed = readFileSync(new URL('../../../openapi.json', import.meta.url), 'utf8')
  assert.ok(committed === openapiJson(), 'acme/openapi.json is stale: run `pnpm openapi` in acme/')
})

test('the document is structurally valid OpenAPI 3.1', () => {
  assert.match(doc.openapi, /^3\.1\.\d+$/)
  assert.ok(doc.info.title && doc.info.version && doc.info.description)
  assert.ok(doc.servers.length > 0)

  const refs: string[] = []
  JSON.stringify(doc, (key, value) => {
    if (key === '$ref') refs.push(value)
    return value
  })
  for (const ref of refs) {
    assert.match(ref, /^#\//)
    let target: unknown = doc
    for (const part of ref.slice(2).split('/')) {
      assert.ok(typeof target === 'object' && target !== null && part in target, ref)
      target = Reflect.get(target, part)
    }
  }

  const ids = operations.map((entry) => entry.operation.operationId)
  assert.equal(new Set(ids).size, ids.length, 'operationIds are unique')

  for (const { path, method, operation } of operations) {
    const where = `${method} ${path}`
    assert.ok(operation.operationId && operation.summary, where)
    assert.ok(Object.keys(operation.responses).length > 0, where)
    for (const response of Object.values(operation.responses)) {
      assert.ok(resolveResponse(response).description, where)
    }
    const params = operation.parameters ?? []
    for (const param of params) {
      assert.ok(['path', 'query', 'header'].includes(param.in) && param.schema, where)
    }
    const inPath = [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1])
    const declared = params.filter((param) => param.in === 'path')
    assert.deepEqual(
      declared.map((param) => param.name),
      inPath,
      `${where} declares its path parameters`,
    )
    assert.ok(
      declared.every((param) => param.required === true),
      `${where} path parameters are required`,
    )
  }
})
