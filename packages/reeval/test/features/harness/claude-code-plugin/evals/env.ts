import { defineEnvironment, defineGrader, type Turn } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

export const house = defineEnvironment('house', ({ plugin }) => ({
  sandbox,
  plugins: [plugin.local('../plugin')],
  files: {
    '~/.claude/settings.json': JSON.stringify({
      env: { HOUSE: '1' },
      enabledPlugins: { 'other@elsewhere': false },
    }),
  },
}))

/** What the scripted agent's `n`th shell command printed. */
export const shellOutput = (turn: Pick<Turn, 'trajectory'> | undefined, n: number) =>
  (turn?.trajectory ?? []).flatMap((e) =>
    e.type === 'tool' && e.tool === 'shell' ? [String(e.output ?? '')] : [],
  )[n]

/** What the fake agent says it loaded: its skills, plugins and MCP servers. */
export const loaded = (turn: Pick<Turn, 'trajectory'> | undefined) =>
  (turn?.trajectory ?? []).flatMap((e) =>
    e.type === 'text' && e.text.startsWith('Loaded ') ? [e.text] : [],
  )[0] ?? ''

/** Whether the fake agent says it loaded the plugin's MCP server itself. */
export const mcpInConfig = defineGrader('mcp-in-config', {
  grade: (c) => loaded(c.turns[0]),
  score: (said) => (said.includes('mcp: house:docs') ? 1 : 0),
})
