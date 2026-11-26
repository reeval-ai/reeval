import { DurableObject } from 'cloudflare:workers'
import type { Store } from '@acme/core'
import { createApp } from './app.ts'
import { createDurableStore } from './durable-store.ts'

/**
 * The Durable Object of one API key. It holds that key's state and serves every `/v1` and `/mcp`
 * request for it, so the services run next to the state and each transaction is atomic.
 */
export class AcmeTenant extends DurableObject<Env> {
  /** The tenant state, in this object's storage. */
  readonly store: Store
  readonly #app

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.store = createDurableStore(ctx.storage.kv)
    this.#app = createApp({ storeForKey: () => this.store, clock: () => new Date() })
  }

  /** Serves one request with the app, on this object's store. */
  override fetch(request: Request): Promise<Response> | Response {
    return this.#app.fetch(request)
  }
}
