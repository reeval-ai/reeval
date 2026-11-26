import { type Context, Hono } from 'hono'
import { createApp, tenantKeyFrom } from './app.ts'

export { AcmeTenant } from './tenant.ts'

// Answers what needs no tenant: /health, the 401s and the 404s. It never touches a store.
const keyless = createApp({
  storeForKey() {
    throw new Error('The keyless app has no store')
  },
})

type WorkerEnv = { Bindings: Env }

function toTenant(c: Context<WorkerEnv>): Promise<Response> | Response {
  const key = tenantKeyFrom(c.req.raw)
  if (key === null) return keyless.fetch(c.req.raw)
  return c.env.TENANT.get(c.env.TENANT.idFromName(key)).fetch(c.req.raw)
}

const router = new Hono<WorkerEnv>()
router.all('/v1/*', toTenant)
router.all('/mcp', toTenant)
router.all('*', (c) => keyless.fetch(c.req.raw))

/**
 * The Worker. A request with an API key for `/v1` or `/mcp` goes to that key's Durable Object.
 * Everything else is answered here, so no object is created for it. Hono matches the paths, so
 * the Worker and the object route a percent-encoded path alike.
 */
export default {
  fetch: (request, env) => router.fetch(request, env),
} satisfies ExportedHandler<Env>
