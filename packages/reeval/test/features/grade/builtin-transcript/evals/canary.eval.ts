import { defineEval } from 'reeval'
import { calledTool, usedSkill } from 'reeval/graders'
import { skilled } from './env.ts'

export default defineEval({
  environment: skilled,
  // The mistake: the agent never called Edit.
  graders: [usedSkill('foo'), calledTool('Edit', { required: true })],
  task: async (c) => {
    await c.send('use the foo skill')
  },
})
