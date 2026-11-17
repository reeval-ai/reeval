import { evaluate, expect } from 'reeval'
import { agentSaw, stock, TOOL } from './env.ts'

// Must fail: reeval's image without the Dockerfile has neither the tool nor the variable.
evaluate('canary', { environments: stock }, async (c) => {
  expect(agentSaw(await c.send('find the tool')).slice(0, 3)).toEqual([
    TOOL,
    TOOL,
    'from-the-image',
  ])
})
