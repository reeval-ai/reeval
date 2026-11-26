import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { baseline, variant } from './env.ts'

// A question is shown only the inputs it turns on: the diff, with no task and no reply.
export default defineEval({
  compare: { control: baseline, variants: [variant] },
  graders: [hasFile('out.txt', 'hi\n')],
  questions: [{ question: 'Which out.txt is better?', across: 'environment', diff: true }],
  task: async (c) => {
    await c.send('write out.txt')
  },
})
