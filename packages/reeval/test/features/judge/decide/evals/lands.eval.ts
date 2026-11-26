import { defineEval, defineGrader } from 'reeval'
import { model, noted, plain, questions } from './env.ts'

// The task acts on a decision about its own state: the model answers from the diff, the call
// lands in the transcript (features.test.ts checks it, masked) and graders read it.
export default defineEval({
  environment: plain,
  graders: [
    defineGrader('decided', {
      grade: (c) => c.decisions.map((d) => d.answers.done ?? null),
      score: (answers) => (answers.length === 1 ? 1 : 0),
    }),
    noted,
  ],
  task: async (c) => {
    await c.send('write the app')
    const { answers } = await c.decide({
      model,
      state: c.state({ diff: true, output: true }),
      questions,
    })
    if (answers.done.probability > 0.5) await c.send('note it')
  },
})
