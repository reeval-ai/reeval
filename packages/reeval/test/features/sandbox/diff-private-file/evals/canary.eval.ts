import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain } from './env.ts'

// Wrong: the agent's private directory is in the diff like any other.
export default defineEval({
  environment: plain,
  graders: [
    observed<string[]>('diff', (diff) => JSON.stringify(diff) === JSON.stringify(['added .token'])),
  ],
  task: async (c) => {
    const turn = await c.send('Store the key.')
    c.observe('diff', turn.diff.files.map((f) => `${f.status} ${f.path}`).sort())
  },
})
