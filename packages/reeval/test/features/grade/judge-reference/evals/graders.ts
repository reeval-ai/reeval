import { defineGrader } from 'reeval'
import { fakeJudge } from 'reeval/judge'

// Each case's reference solution; the judge sees it as a diff against the attempt's files.
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
