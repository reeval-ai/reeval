import { defineEval } from 'reeval'
import { usedSkill } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  // The mistake: the agent loaded foo, not other.
  graders: [usedSkill('other')],
  task: async (c) => {
    await c.send('load the foo skill')
  },
})
