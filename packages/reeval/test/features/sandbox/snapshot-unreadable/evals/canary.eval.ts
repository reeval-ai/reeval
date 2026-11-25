import { defineEval, expect } from 'reeval'
import { agentSaw, rooted } from './env.ts'

// Must fail: with docker({ root: true }) the agent is root, and root's directories are its own.
export default defineEval({
  environment: rooted,
  task: async (c) => {
    const [agent] = agentSaw(await c.send('Read the snapshot.'))
    expect(agent?.trim()).toBe('refused')
  },
})
