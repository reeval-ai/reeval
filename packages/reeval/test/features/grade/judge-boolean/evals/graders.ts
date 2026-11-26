import { defineGrader } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'

const says = (text: string) =>
  fakeJudge({ score: (state) => (JSON.stringify(state).includes(text) ? 0.9 : 0.1) })

// A yes/no question scores 1 for yes; the fake judge says yes when the state shows the text.
export const exportsAnswer = judge('Does src/app.js export answer?', {
  inputs: { contents: ['src/**'] },
  model: says('export const answer = 42'),
})

export const says41 = defineGrader('says-41', {
  judge: {
    question: 'Does the change set answer to 41?',
    inputs: { diff: true },
    model: says('answer = 41'),
  },
})
