import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { quick } from './env.ts'

// Must fail: a step that finishes within its timeout isn't cut off.
export default defineEval({
  environment: quick,
  graders: [hasFile('slept', { name: 'no-file-slept', score: (has) => (has ? 0 : 1) })],
  task: async (c) => {
    await c.exec('true')
  },
})
