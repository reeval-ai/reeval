import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'

const sees42 = (state: unknown) => JSON.stringify(state).includes('answer = 42')

// One answer per model; the score is the mean of each answer's score.
export const readable = judge('How readable is the change?', {
  answers: ['good', 'okay', 'poor'],
  score: { good: 1, okay: 0.5, poor: 0 },
  inputs: { diff: true },
  models: [
    fakeJudge({ answer: 'good' }),
    fakeJudge({ answer: (state) => (sees42(state) ? 'good' : 'poor') }),
  ],
})

export const harsh = judge('How readable is the change?', {
  name: 'harsh',
  answers: ['good', 'okay', 'poor'],
  score: { good: 1, okay: 0.5, poor: 0 },
  inputs: { diff: true },
  models: [fakeJudge({ answer: 'good' }), fakeJudge({ answer: 'poor' })],
})

// Answers with no score record only.
export const tone = judge('What tone does the reply take?', {
  answers: ['terse', 'chatty'],
  inputs: { output: true },
  model: fakeJudge({ answer: 'terse' }),
})
