// Cursor's catalog entry: how its agent reads what it's given, and what it reports.

import { PLUGIN_PARTS } from '../spec.ts'
import type { HarnessCatalogEntry } from './entry.ts'
import { LAYOUTS } from './layouts.ts'
import { cursorMcpServers } from './mcp.ts'
import { cursorUnreported } from './reported.ts'
import { cursorSpawns } from './subagents.ts'

export const cursor = {
  ...LAYOUTS.cursor,
  pluginParts: PLUGIN_PARTS,
  name: 'Cursor',
  factory: 'cursor',
  // The bootstrap installs `@cursor/sdk` with npm, which picks its build for the platform.
  platforms: ['linux', 'darwin'],
  reasoning: 'streamed',
  reasoningTokens: false,
  credential: 'CURSOR_API_KEY',
  // Web search and fetch: CURSOR_SDK_RECOVERED_TOOLS.
  unreported: cursorUnreported,
  mcpServers: cursorMcpServers,
  // The SDK's usage for a turn doesn't say whether it counts a subagent's model calls.
  subagents: { events: 'none', usage: 'unknown', spawns: cursorSpawns },
} satisfies HarnessCatalogEntry
