import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { copier, writer } from './agents.ts'
import { marked, plain } from './env.ts'

// Must fail: the marker says ok, not nope, so every variant fails too.
export default defineEval({
  agents: [writer, copier],
  compare: { control: plain, variants: [marked] },
  graders: [hasFile('marker.txt', /nope/)],
  task: async (c) => {
    // A session keeps the workspace hasFile reads; the exec starts one.
    await c.exec('true')
  },
})
