import { evaluate, expect } from 'reeval'
import { agentSaw, image, TOOL } from './env.ts'

// The image's ENV reaches the agent's commands over SSH, its PATH in login shells too.
evaluate('lands', { environments: image }, async (c) => {
  expect(agentSaw(await c.send('find the tool')).slice(0, 3)).toEqual([
    TOOL,
    TOOL,
    'from-the-image',
  ])
})
