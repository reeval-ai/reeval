import { defineEnvironment, type Turn } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

export const house = defineEnvironment('house', ({ plugin }) => ({
  sandbox,
  plugins: [plugin.local('../plugin')],
}))

/** What the fake agent says it loaded: its skills, plugins and MCP servers. */
export const loaded = (turn: Pick<Turn, 'trajectory'> | undefined) =>
  (turn?.trajectory ?? []).flatMap((e) =>
    e.type === 'text' && e.text.startsWith('Loaded ') ? [e.text] : [],
  )[0] ?? ''
