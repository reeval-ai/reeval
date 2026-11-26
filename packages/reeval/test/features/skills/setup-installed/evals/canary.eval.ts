import { defineEval } from 'reeval'
import { usedSkill } from 'reeval/graders'
import { installed } from './env.ts'

// Must fail: the setup step installed house-farewell too, but the agent never opened it.
export default defineEval({
  environment: installed,
  graders: [usedSkill('house-farewell')],
  task: async (c) => {
    await c.send('greet the crew')
  },
})
