import { defineEval, expect } from 'reeval'
import { closed } from './env.ts'

// An expected host is still refused at CONNECT; only how reeval reports it changes.
export default defineEval({
  environment: closed,
  task: async (c) => {
    await c.send('call home')
    expect((await c.readFile('reached.txt'))?.trim()).toBe('403 000')
  },
})
