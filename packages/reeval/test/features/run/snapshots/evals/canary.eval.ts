import { defineEval, expect } from 'reeval'
import { snapshots } from './env.ts'

// Must fail: the agent built the app, not something else. It takes no snapshot.
export default defineEval({
  environment: snapshots,
  snapshot: false,
  task: async (c) => {
    await c.send('build the app')
    expect(await c.readFile('app/built.js')).toBe('something else')
  },
})
