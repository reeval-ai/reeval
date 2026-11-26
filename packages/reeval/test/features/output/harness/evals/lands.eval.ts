import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { copier, writer } from './agents.ts'

// Compare agents: a row per harness with its `N of M`.
export default defineEval({
  agents: [writer, copier],
  graders: [hasFile('out.txt')],
  task: async (c) => {
    await c.send('write out.txt')
  },
})
