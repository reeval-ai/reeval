import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { idler, writer } from './agents.ts'

// Must fail: the idler writes nothing, so its row names the failed grader.
export default defineEval({
  agents: [writer, idler],
  graders: [hasFile('out.txt')],
  task: async (c) => {
    await c.send('write out.txt')
  },
})
