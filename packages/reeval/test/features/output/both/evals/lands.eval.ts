import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { copier, writer } from './agents.ts'
import { marked, plain } from './env.ts'

// Both: the harness outer, its arms inner.
export default defineEval({
  agents: [writer, copier],
  compare: { control: plain, variants: [marked] },
  graders: [hasFile('marker.txt')],
  task: async (c) => {
    // A session keeps the workspace hasFile reads; the exec starts one.
    await c.exec('true')
  },
})
