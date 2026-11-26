import { defineEval } from 'reeval'
import { hasFile, judge } from 'reeval/graders'
import { plain, withDocs } from './environments.ts'

export default defineEval({
  compare: { control: plain, variants: [withDocs] },
  runs: 3,
  graders: [
    hasFile('answer.md', /limit/, { name: 'names-the-parameter' }),
    judge('Does answer.md say how to page through /notes?', {
      inputs: { contents: ['answer.md'] },
    }),
  ],
  task: async (c) => {
    await c.send('How do I page through GET /notes? Write the answer to answer.md.')
  },
})
