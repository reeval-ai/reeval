import { hasFile, judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'

export const writesGreet = hasFile('greet.js')

export const namesTheCause = judge('How clearly does the answer name the root cause?', {
  answers: ['clearly', 'partly', 'not at all'],
  inputs: { files: true },
  score: { clearly: 1, partly: 0.5, 'not at all': 0 },
  model: fakeJudge({ answer: 'partly' }),
})
