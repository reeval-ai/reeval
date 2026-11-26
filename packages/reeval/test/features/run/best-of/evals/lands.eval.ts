import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// The second attempt wants another word, so the first two split and a third breaks the tie.
export default defineEval({
  runs: { bestOf: 3 },
  graders: [
    observed<{ attempt: number; word: string }>(
      'word',
      ({ attempt, word }) => word === (attempt === 2 ? 'hello' : 'ahoy'),
    ),
  ],
  task: async (c) => {
    c.observe('word', { attempt: c.attempt.n, word: await c.readFile('word.txt') })
  },
})
