#!/usr/bin/env node
import { createMemoryStore, type Store } from '@acme/core'
import { serve } from '@hono/node-server'
import { createApp } from './app.ts'

const portText = process.env.PORT ?? '8787'
const port = Number(portText)
if (!/^[0-9]+$/.test(portText) || port > 65535) {
  console.error(`acme-server: PORT must be an integer from 0 to 65535, got "${portText}"`)
  process.exit(1)
}
const hostname = process.env.HOST || '127.0.0.1'

const stores = new Map<string, Store>()
const app = createApp({
  storeForKey(apiKey) {
    let store = stores.get(apiKey)
    if (!store) {
      store = createMemoryStore()
      stores.set(apiKey, store)
    }
    return store
  },
  clock: () => new Date(),
})

const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  const host = info.family === 'IPv6' ? `[${info.address}]` : info.address
  console.log(`acme-server listening on http://${host}:${info.port}`)
})

function shutdown(): void {
  server.close(() => process.exit(0))
  if ('closeAllConnections' in server) server.closeAllConnections()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
