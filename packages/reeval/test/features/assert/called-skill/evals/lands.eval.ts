import { defineEval } from 'reeval'
import { usedSkill } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  graders: [usedSkill('foo')],
  task: async (c) => {
    await c.send('load the foo skill')
  },
})
