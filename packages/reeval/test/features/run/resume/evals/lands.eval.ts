import { defineEval, expect } from 'reeval'
import { resume } from './env.ts'

export default defineEval({
  environment: resume,
  task: async (c) => {
    expect(await c.readFile('marker.txt')).toBe('resume')
  },
})
