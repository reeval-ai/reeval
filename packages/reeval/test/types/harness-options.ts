// Compile-time checks of the shared harness options, run by `pnpm typecheck`: each harness's
// factory takes only the options it can enforce, and `withOptions` only what every agent in its
// list can. An unused `@ts-expect-error` fails the build too.

import { claudeCode, codex, cursor, opencode, pi, withOptions } from '../../src/agent.ts'

claudeCode({
  model: 'claude-sonnet-5',
  instructions: 'Be brief.',
  systemPrompt: 'You are a test agent.',
  tools: ['read', 'bash', 'webSearch'],
  commands: ['npm test'],
})
opencode({
  model: 'anthropic/claude-sonnet-5',
  systemPrompt: 'x',
  tools: ['grep'],
  commands: ['ls'],
})
pi({ model: 'anthropic/claude-sonnet-5', tools: ['glob'], commands: ['ls'] })
codex({ model: 'gpt-5.6-luna', instructions: 'x', systemPrompt: 'x' })
cursor({ model: 'composer-2.5', instructions: 'x' })

// @ts-expect-error Cursor can't replace its system prompt
cursor({ model: 'composer-2.5', systemPrompt: 'x' })
// @ts-expect-error Codex has no tool filter
codex({ model: 'gpt-5.6-luna', tools: ['bash'] })
// @ts-expect-error Codex can't hold commands to a list
codex({ model: 'gpt-5.6-luna', commands: ['ls'] })
// @ts-expect-error pi has no web search tool
pi({ model: 'anthropic/claude-sonnet-5', tools: ['webSearch'] })
// @ts-expect-error tools are the common names, not a harness's own
claudeCode({ model: 'claude-sonnet-5', tools: ['Bash'] })

const agents = [
  claudeCode({ model: 'claude-sonnet-5' }),
  pi({ model: 'anthropic/claude-sonnet-5' }),
]
withOptions(agents, { tools: ['read', 'bash'], commands: ['npm test'] })
// @ts-expect-error pi in the list has no web search tool
withOptions(agents, { tools: ['webSearch'] })
// @ts-expect-error Codex in the list has no tool filter
withOptions([...agents, codex({ model: 'gpt-5.6-luna' })], { tools: ['bash'] })
withOptions([...agents, codex({ model: 'gpt-5.6-luna' })], { systemPrompt: 'x' })
const mixed = [codex({ model: 'gpt-5.6-luna' }), cursor({ model: 'composer-2.5' })]
// @ts-expect-error Cursor in the list can't replace its system prompt
withOptions(mixed, { systemPrompt: 'x' })
