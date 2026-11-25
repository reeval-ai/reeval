import { defineEval, expect } from 'reeval'
import { installed } from './env.ts'

// A skill a setup step installed counts when the agent opens it, though reeval didn't place it.
export default defineEval({
  environment: installed,
  task: async (c) => {
    const turn = await c.send('greet the crew')
    expect(turn).toHaveCalledSkill('house-greeting')
  },
})
