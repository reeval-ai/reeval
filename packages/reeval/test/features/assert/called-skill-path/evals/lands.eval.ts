import { defineEval } from 'reeval'
import { usedSkill } from 'reeval/graders'
import { skilled } from './env.ts'

export default defineEval({
  environment: skilled,
  graders: [usedSkill('foo')],
  task: async (c) => {
    await c.send('read the foo skill')
  },
})
