import { defineEval, expect } from 'reeval'
import { picked } from './env.ts'

// Must fail: with a name that is there, only that skill is staged, not its sibling.
export default defineEval({
  environment: picked,
  task: async (c) => {
    const staged = (await c.exec('ls .agents/skills')).stdout.trim().split('\n')
    expect(staged).toEqual(['house-farewell', 'house-greeting'])
  },
})
