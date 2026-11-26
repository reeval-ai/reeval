import { defineEval } from 'reeval'
import { usedSkill } from 'reeval/graders'
import { installed } from './env.ts'

// A skill a setup step installed counts when the agent opens it, though reeval didn't place it.
export default defineEval({
  environment: installed,
  graders: [usedSkill('house-greeting')],
  task: async (c) => {
    await c.send('greet the crew')
  },
})
