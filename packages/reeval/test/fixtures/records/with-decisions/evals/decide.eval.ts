import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
import { fakeDecisionModel } from 'reeval/testing'

const model = fakeDecisionModel({
  done: { type: 'boolean', probability: 0.9 },
  next: { type: 'choice', choice: 'notes', probabilities: { notes: 0.7, stop: 0.3 } },
  quality: { type: 'score', score: 1.6, probabilities: { 0: 0.1, 1: 0.2, 2: 0.7 } },
})

const decided = defineGrader('decided', { grade: (c) => c.decisions.length === 1 })

export default defineEval({
  environment: defineEnvironment('fake', { sandbox: fakeSandbox() }),
  graders: [decided],
  task: async (c) => {
    await c.send('Write src/app.js')
    const { answers } = await c.decide({
      model,
      state: await c.state({ diff: true, output: true }),
      questions: {
        done: { type: 'boolean', instructions: 'Did the agent write the app?' },
        next: {
          type: 'choice',
          instructions: 'What next?',
          criteria: { notes: 'Write notes', stop: null },
        },
        quality: {
          type: 'score',
          instructions: 'How good is it?',
          criteria: ['poor', 'fair', 'good'],
        },
      },
    })
    if (answers.next.choice === 'notes') await c.send('Write NOTES.md')
  },
})
