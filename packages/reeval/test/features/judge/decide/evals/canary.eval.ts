import { defineEval, expect } from 'reeval'
import { model, plain, questions } from './env.ts'

// The mistake: the model is shown only the agent's output, which never names the answer.
export default defineEval({
  environment: plain,
  task: async (c) => {
    await c.send('write the app')
    const { answers } = await c.decide({ model, state: c.state({ output: true }), questions })
    if (answers.done.probability > 0.5) await c.send('note it')
    expect(c.turns).toHaveLength(2)
  },
})
