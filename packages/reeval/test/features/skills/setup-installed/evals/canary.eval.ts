import { defineEval, expect } from 'reeval'
import { installed } from './env.ts'

// Must fail: the setup step installed house-farewell too, but the agent never opened it.
export default defineEval({
  environment: installed,
  task: async (c) => {
    const turn = await c.send('greet the crew')
    expect(turn).toHaveCalledSkill('house-farewell')
  },
})
