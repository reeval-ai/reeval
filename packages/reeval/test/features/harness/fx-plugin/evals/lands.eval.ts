import { defineEval, defineGrader } from 'reeval'
import { house, loaded } from './env.ts'

const followed = defineGrader('followed', {
  files: ['style.txt'],
  grade: async (c) => ({
    loaded: loaded(c.turns[0]),
    style: (await c.readFile('style.txt'))?.trim() ?? null,
  }),
  score: (g) => (g.loaded.includes('mcp: house:docs') && g.style === 'PLOVER-27' ? 1 : 0),
})

// Under fx's layout, which has no plugins of its own, the plugin's skill joins fx's home skills
// and its MCP server goes over ACP with the environment's, as house:docs.
export default defineEval({
  environment: house,
  graders: [followed],
  task: async (c) => {
    await c.send('follow the house style')
  },
})
