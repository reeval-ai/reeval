import { defineEval, expect } from 'reeval'
import { present } from './env.ts'

// Must fail: a step whose cwd exists runs there.
export default defineEval({
  environment: present,
  task: async (c) => {
    expect(await c.readFile('sub/ran')).toBeNull()
  },
})
