import { defineEnvironment, defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
import { fakeDecisionModel } from 'reeval/testing'

const outage = fakeDecisionModel({}, { fail: 'overloaded' })

export default defineEval({
  environment: defineEnvironment('fake', { sandbox: fakeSandbox() }),
  task: async (c) => {
    await c.send('Write src/app.js')
    await c.decide({
      model: outage,
      state: 'Is it done?',
      questions: { done: { type: 'boolean', instructions: 'Done?' } },
    })
  },
})
