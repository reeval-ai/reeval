import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { placed, writable } from './env.ts'

// Under an engine whose exec starts at umask 0000, nothing reeval or the agent makes is
// group- or world-writable.
export default defineEval({
  environment: placed,
  graders: [observed<string[]>('writable', (paths) => paths.length === 0)],
  task: async (c) => {
    await c.send('make things')
    c.observe('writable', await writable(c))
  },
})
