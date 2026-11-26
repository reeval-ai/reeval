import { defineEval } from 'reeval'
import { greeting, readsSkill } from './env.ts'

// A harness-placed skill is where the harness's adapter puts it (the agent's first read).
export default defineEval({
  environment: greeting,
  graders: [readsSkill(0)],
  task: async (c) => {
    await c.send('read the house greeting skill')
  },
})
