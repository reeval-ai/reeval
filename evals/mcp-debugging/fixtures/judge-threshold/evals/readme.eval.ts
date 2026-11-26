import { defineEval, regression } from 'reeval'
import { hasFile, judge } from 'reeval/graders'

export default defineEval({
  graders: [
    hasFile('README.md', /notes\.js add/, { required: true }),
    judge('How well does the README explain adding a note?', {
      answers: ['fully', 'mostly', 'not at all'],
      inputs: { contents: ['README.md'] },
      score: { fully: 1, mostly: 0.8, 'not at all': 0 },
    }),
  ],
  target: regression(0.95),
  task: async (c) => {
    await c.send('Write README.md explaining how to add a note with notes.js.')
  },
})
