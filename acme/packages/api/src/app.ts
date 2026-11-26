import {
  AcmeError,
  type AcmeServices,
  AddCartItemInputSchema,
  type Clock,
  CreateOrderInputSchema,
  createServices,
  invalidRequest,
  OrderListQuerySchema,
  ProductListQuerySchema,
  type Store,
  UpdateCartItemInputSchema,
} from '@acme/core'
import { buildServer } from '@acme/mcp/server'
import { type AuthInfo, createMcpHandler } from '@modelcontextprotocol/server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { z } from 'zod'

/** The dependencies of the app. */
export interface AcmeAppDeps {
  /** The state of one tenant. The argument is the full API key. */
  storeForKey: (apiKey: string) => Store | Promise<Store>
  /** The source of time. Defaults to the real clock. */
  clock?: Clock
}

/** The Hono environment: the services of the authenticated tenant, set by the auth middleware. */
export interface AcmeEnv {
  Variables: { services: AcmeServices }
}

const UNAUTHORIZED_MESSAGE =
  'Missing or invalid API key: it must start with acme_test_ (for example acme_test_demo), sent as "Authorization: Bearer <key>" (the CLI and the SDK send ACME_API_KEY this way)'

const BEARER_PATTERN = /^bearer +(\S+)$/i
const KEY_PATTERN = /^acme_test_[A-Za-z0-9._~+/-]+=*$/
const MAX_KEY_LENGTH = 256
const MAX_BODY_BYTES = 64 * 1024

/**
 * Reads the tenant key from the `Authorization` header.
 *
 * @param request - The incoming request.
 * @returns The full key, or null unless the header is `Bearer acme_test_<key>`, the scheme in any
 * case, with a token68 key of at most 256 characters.
 */
export function tenantKeyFrom(request: Request): string | null {
  const key = BEARER_PATTERN.exec(request.headers.get('authorization') ?? '')?.[1]
  if (key === undefined || key.length > MAX_KEY_LENGTH || !KEY_PATTERN.test(key)) return null
  return key
}

/**
 * Creates the HTTP app. It uses only web-standard APIs, so it runs on Node and on Workers.
 *
 * @param deps - Where each tenant's state lives, and the clock.
 */
export function createApp(deps: AcmeAppDeps): Hono<AcmeEnv> {
  const app = new Hono<AcmeEnv>()
  const clock = deps.clock ?? (() => new Date())

  const mcp = createMcpHandler(
    async ({ authInfo }) => {
      if (authInfo === undefined) throw new AcmeError('unauthorized', 'Missing API key')
      return buildServer(createServices(await deps.storeForKey(authInfo.token), clock))
    },
    { maxRequestBodySize: MAX_BODY_BYTES },
  )

  app.get('/health', (c) => c.json({ ok: true }))

  app.use('/v1/*', async (c, next) => {
    const apiKey = tenantKeyFrom(c.req.raw)
    if (apiKey === null) {
      throw new AcmeError('unauthorized', UNAUTHORIZED_MESSAGE)
    }
    c.set('services', createServices(await deps.storeForKey(apiKey), clock))
    await next()
  })
  app.use(
    '/v1/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError() {
        throw new AcmeError(
          'invalid_request',
          `The request body is larger than ${MAX_BODY_BYTES} bytes`,
          413,
        )
      },
    }),
  )

  const v1 = app.basePath('/v1')

  v1.get('/products', async (c) => {
    const query = ProductListQuerySchema.safeParse(c.req.query())
    if (!query.success) throw invalidRequest(query.error)
    return c.json(await c.var.services.products.list(query.data))
  })
  v1.get('/products/:id', async (c) => c.json(await c.var.services.products.get(c.req.param('id'))))

  v1.post('/carts', async (c) => c.json(await c.var.services.carts.create(), 201))
  v1.get('/carts/:id', async (c) => c.json(await c.var.services.carts.get(c.req.param('id'))))
  v1.post('/carts/:id/items', async (c) =>
    c.json(
      await c.var.services.carts.addItem(
        c.req.param('id'),
        await readBody(c.req.raw, AddCartItemInputSchema),
      ),
    ),
  )
  v1.patch('/carts/:id/items/:productId', async (c) =>
    c.json(
      await c.var.services.carts.updateItem(
        c.req.param('id'),
        c.req.param('productId'),
        await readBody(c.req.raw, UpdateCartItemInputSchema),
      ),
    ),
  )
  v1.delete('/carts/:id/items/:productId', async (c) =>
    c.json(await c.var.services.carts.removeItem(c.req.param('id'), c.req.param('productId'))),
  )

  v1.post('/orders', async (c) => {
    const body = await readJson(c.req.raw)
    const idempotencyKey = c.req.header('idempotency-key')
    const input = idempotencyKey === undefined ? body : { ...body, idempotencyKey }
    const parsed = CreateOrderInputSchema.safeParse(input)
    if (!parsed.success) throw invalidRequest(parsed.error)
    return c.json(await c.var.services.orders.create(parsed.data), 201)
  })
  v1.get('/orders', async (c) => {
    const query = OrderListQuerySchema.safeParse(c.req.query())
    if (!query.success) throw invalidRequest(query.error)
    return c.json(await c.var.services.orders.list(query.data))
  })
  v1.get('/orders/:id', async (c) => c.json(await c.var.services.orders.get(c.req.param('id'))))
  v1.post('/orders/:id/cancel', async (c) =>
    c.json(await c.var.services.orders.cancel(c.req.param('id'))),
  )

  v1.post('/reset', async (c) => c.json(await c.var.services.reset()))

  app.all('/mcp', async (c) => {
    const apiKey = tenantKeyFrom(c.req.raw)
    if (apiKey === null) throw new AcmeError('unauthorized', UNAUTHORIZED_MESSAGE)
    const authInfo: AuthInfo = { token: apiKey, clientId: 'acme', scopes: [] }
    return mcp.fetch(c.req.raw, { authInfo })
  })

  app.notFound((c) =>
    c.json(
      new AcmeError('not_found', `No route for ${c.req.method} ${c.req.path}`).toEnvelope(),
      404,
    ),
  )

  app.onError((error, c) => {
    if (error instanceof AcmeError) {
      const challenge = error.code === 'unauthorized' ? { 'WWW-Authenticate': 'Bearer' } : undefined
      return c.json(error.toEnvelope(), error.status as ContentfulStatusCode, challenge)
    }
    console.error(error)
    return c.json(new AcmeError('internal_error', 'Internal server error').toEnvelope(), 500)
  })

  return app
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new AcmeError('invalid_request', 'The request body is not valid JSON')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AcmeError('invalid_request', 'The request body must be a JSON object')
  }
  return Object.fromEntries(Object.entries(body))
}

async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await readJson(request))
  if (!parsed.success) throw invalidRequest(parsed.error)
  return parsed.data
}
