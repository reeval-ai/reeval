import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain } from './env.ts'

// The snapshot's git reads files the agent kept to itself, though the agent can't read its git dir.
export default defineEval({
  environment: plain,
  graders: [
    observed<string[]>(
      'diff',
      (diff) => JSON.stringify(diff) === JSON.stringify(['added .token', 'added private/key']),
    ),
  ],
  task: async (c) => {
    const turn = await c.send('Store the key.')
    c.observe('diff', turn.diff.files.map((f) => `${f.status} ${f.path}`).sort())
  },
})
