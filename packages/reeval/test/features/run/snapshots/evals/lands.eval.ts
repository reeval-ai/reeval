import { defineEval, expect } from 'reeval'
import { snapshots } from './env.ts'

export default defineEval({
  environment: snapshots,
  task: async (c) => {
    await c.send('build the app')
    expect(await c.readFile('app/built.js')).toContain('built')
  },
})
