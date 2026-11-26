#!/usr/bin/env node
import { Acme } from '@acme/sdk'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { buildServer } from './server.ts'

let acme: Acme
try {
  acme = new Acme()
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  console.error(
    `acme-mcp: ${reason}\nSet ACME_API_KEY (and ACME_BASE_URL for a server other than the default).`,
  )
  process.exit(1)
}

serveStdio(() => buildServer(acme))
