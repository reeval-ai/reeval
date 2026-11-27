import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// The second trial wants another word, so the first two split and a third breaks the tie.
export default defineEval({
  trials: { bestOf: 3 },
  graders: [
    observed<{ trial: number; word: string }>(
      'word',
      ({ trial, word }) => word === (trial === 2 ? 'hello' : 'ahoy'),
    ),
  ],
  task: async (c) => {
    c.observe('word', { trial: c.trial.n, word: await c.readFile('word.txt') })
  },
})
