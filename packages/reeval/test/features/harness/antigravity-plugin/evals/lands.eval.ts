import { isDeepStrictEqual } from 'node:util'
import { defineEval, defineGrader } from 'reeval'
import { house, loaded, shellOutput } from './env.ts'

const timed = (args: unknown) =>
  Array.isArray(args) && isDeepStrictEqual(args.slice(1, 4), ['--name', 'house:docs', '--'])

const keptWhole = defineGrader('kept-whole', {
  grade: (c) => {
    const turn = c.turns[0]
    return {
      skill: shellOutput(turn, 0) ?? null,
      placed: shellOutput(turn, 1) ?? null,
      loaded: loaded(turn),
      docs: JSON.parse(shellOutput(turn, 2) ?? '{}').mcpServers?.docs?.args ?? null,
      installed: JSON.parse(shellOutput(turn, 3) ?? '{}').mcpServers?.docs?.args ?? null,
    }
  },
  score: ({ skill, placed, loaded, docs, installed }) =>
    skill?.includes('Write every name in kebab-case.') &&
    placed === 'not placed\n' &&
    loaded.includes('plugins: house (skills, mcp, rules)') &&
    !loaded.includes('house:docs') &&
    // The placed plugin's server goes through reeval's MCP timer, at its placed stamp.mjs.
    timed(docs) &&
    /\/\.reeval\/plugins\/house\/stamp\.mjs$/.test(docs?.at(-1) ?? '') &&
    // What agy installed is the timed server, not the plugin's own.
    (process.env.REEVAL_FIXTURE_SANDBOX !== 'docker' || timed(installed))
      ? 1
      : 0,
})

// Under Antigravity's layout, the plugin stays whole where the session copied it (the adapter
// installs it with agy plugin install): its skill isn't placed with Antigravity's own, its rule
// isn't refused, and its MCP server is left to the CLI, from the plugin's rewritten .mcp.json.
export default defineEval({
  environment: house,
  graders: [keptWhole],
  task: async (c) => {
    await c.send('read the plugin')
  },
})
