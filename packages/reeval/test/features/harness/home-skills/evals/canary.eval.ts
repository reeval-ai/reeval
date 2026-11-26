import { defineEval } from 'reeval'
import { greeting, readsSkill } from './env.ts'

// Must fail: the skill isn't also in the directory it must not be in (the agent's second read).
export default defineEval({
  environment: greeting,
  graders: [readsSkill(1)],
  task: async (c) => {
    await c.send('read the house greeting skill')
  },
})
