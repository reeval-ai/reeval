import { defineEval } from 'reeval'
import { usedSkill } from 'reeval/graders'
import { skilled } from './env.ts'

export default defineEval({
  environment: skilled,
  // The mistake: the agent read foo's SKILL.md, not other's.
  graders: [usedSkill('other')],
  task: async (c) => {
    await c.send('read the foo skill')
  },
})
