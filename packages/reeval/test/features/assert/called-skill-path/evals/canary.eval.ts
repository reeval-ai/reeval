import { defineEval, expect } from 'reeval'
import { skilled } from './env.ts'

export default defineEval({
  environment: skilled,
  task: async (c) => {
    const turn = await c.send('read the foo skill')
    expect(turn).toHaveCalledSkill('other')
  },
})
