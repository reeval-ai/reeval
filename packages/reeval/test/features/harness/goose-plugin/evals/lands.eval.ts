import { defineEval, defineGrader } from 'reeval'
import { house, loaded, shellOutput } from './env.ts'

const loadsPlugin = defineGrader('loads-the-plugin', {
  grade: (c) => ({ skill: shellOutput(c.turns[0], 0) ?? null, loaded: loaded(c.turns[0]) }),
  score: (g) =>
    g.skill?.includes('Write every name in kebab-case.') &&
    g.loaded.includes('plugins: house (skills, mcp)') &&
    g.loaded.includes('mcp: house:docs')
      ? 1
      : 0,
})

// Under Goose's layout, the plugin's items join Goose's own: its skill is placed with Goose's home
// skills, and its MCP server is an extension in Goose's config, as house:docs.
export default defineEval({
  environment: house,
  graders: [loadsPlugin],
  task: async (c) => {
    await c.send('read the plugin')
  },
})
