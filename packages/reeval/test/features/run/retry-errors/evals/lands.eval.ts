import { defineEval, expect } from 'reeval'
import { retry } from './env.ts'

export default defineEval({
  environment: retry,
  task: async (c) => {
    await c.send('Say done.')
    expect(await c.readFile('marker.txt')).toBe('retry')
  },
})
