// Claude Code's catalog entry: how its agent reads what it's given, and what it reports.
import type { HarnessCatalogEntry } from './entry.ts'
import { LAYOUTS } from './layouts.ts'
import { claudeMcpServers } from './mcp.ts'
import { CLAUDE_FORMAT_PARTS } from './plugins.ts'
import { claudeCodeCost } from './reported.ts'
import { claudeSpawns, claudeStoredSubagents } from './subagents.ts'

export const claudeCode = {
  ...LAYOUTS['claude-code'],
  pluginParts: CLAUDE_FORMAT_PARTS,
  name: 'Claude Code',
  factory: 'claudeCode',
  bridgePort: true,
  platforms: ['linux', 'darwin'],
  stepPerCall: true,
  reasoning: 'streamed',
  reasoningTokens: true,
  // The bridge streams a subagent's messages; the turn's usage leaves out its model calls, which
  // its own session log stores. Its reported cost counts them.
  subagents: {
    events: 'streamed',
    usage: 'separate',
    spawns: claudeSpawns,
    stored: async () => claudeStoredSubagents,
  },
  reportedCost: claudeCodeCost,
  credential: 'ANTHROPIC_API_KEY',
  // A Claude subscription's token from `claude setup-token`, which the CLI sends as a Bearer
  // token on the same endpoints. ANTHROPIC_AUTH_TOKEN isn't one: it's a gateway's key, which
  // api.anthropic.com doesn't take.
  fallbackCredentials: ['CLAUDE_CODE_OAUTH_TOKEN'],
  mcpServers: claudeMcpServers,
} satisfies HarnessCatalogEntry
