import { defineEval, expect } from 'reeval'
import { agentSaw, stock, TOOL } from './env.ts'

// Must fail: reeval's image without the Dockerfile doesn't have its tool on PATH.
export default defineEval({
  environment: stock,
  task: async (c) => {
    const [agent] = agentSaw(await c.send('find the tool'))
    expect(agent?.trim()).toBe(`${TOOL}\n${TOOL}`)
  },
})
