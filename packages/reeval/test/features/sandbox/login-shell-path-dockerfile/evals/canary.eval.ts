import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, stock, TOOL } from './env.ts'

// Must fail: reeval's image without the Dockerfile doesn't have its tool on PATH.
export default defineEval({
  environment: stock,
  graders: [observed('agent-saw', (saw) => saw === `${TOOL}\n${TOOL}`)],
  task: async (c) => {
    const [agent] = agentSaw(await c.send('find the tool'))
    c.observe('agent-saw', agent?.trim() ?? null)
  },
})
