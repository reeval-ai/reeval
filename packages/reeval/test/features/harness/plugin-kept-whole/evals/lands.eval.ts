import { isDeepStrictEqual } from 'node:util'
import { defineEval, defineGrader } from 'reeval'
import { house, loaded, shellOutput } from './env.ts'

const keptWhole = defineGrader('kept-whole', {
  grade: (c) => {
    const turn = c.turns[0]
    return {
      skill: shellOutput(turn, 0) ?? null,
      placed: shellOutput(turn, 1) ?? null,
      loaded: loaded(turn),
      docs: JSON.parse(shellOutput(turn, 2) ?? '{}').mcpServers?.docs?.args ?? null,
    }
  },
  score: ({ skill, placed, loaded, docs }) =>
    skill?.includes('Write every name in kebab-case.') &&
    placed === 'not placed\n' &&
    loaded.includes('plugins: house (skills, mcp)') &&
    !loaded.includes('house:docs') &&
    // The placed plugin's server goes through reeval's MCP timer, at its placed stamp.mjs.
    isDeepStrictEqual(docs?.slice(1, 4), ['--name', 'house:docs', '--']) &&
    /\/\.reeval\/plugins\/house\/stamp\.mjs$/.test(docs?.at(-1) ?? '')
      ? 1
      : 0,
})

// The plugin stays whole where the session copied it, for the harness to load itself: its skill
// isn't placed with the harness's own, and its MCP server is left to the harness.
export default defineEval({
  environment: house,
  graders: [keptWhole],
  task: async (c) => {
    await c.send('read the plugin')
  },
})
