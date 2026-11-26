import { defineGrader } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'

export const answers42 = defineGrader('answers-42', {
  files: ['src/**'],
  grade: async (c) => (await c.readFile('src/app.js')).includes('answer = 42'),
})

// Recorded only: a number with no score.
export const turnCount = defineGrader('turn-count', { grade: (c) => c.turns.length })

export const readable = judge('How readable is the change?', {
  answers: ['good', 'okay', 'poor'],
  score: { good: 1, okay: 0.5, poor: 0 },
  inputs: { diff: true },
  models: [fakeJudge({ answer: 'good' }), fakeJudge({ answer: 'okay' })],
})

// Answers with no score record only.
export const tone = judge('What tone does the reply take?', {
  answers: ['terse', 'chatty'],
  inputs: { output: true },
  model: fakeJudge({ answer: 'terse' }),
})

export const matches = defineGrader<{ solution: string }>('matches-reference', ({ directory }) => ({
  judge: {
    question: "Does the attempt's src/app.js match the reference?",
    inputs: { reference: 'diff' },
    reference: (item) => directory(`../references/${item.solution}`),
    model: fakeJudge({
      score: (state) => (JSON.stringify(state).includes('[reeval: unchanged]') ? 1 : 0),
    }),
  },
}))
