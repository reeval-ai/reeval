import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { marked, plain } from './env.ts'

// Must fail: the marker says ok, not nope, so the variant fails too.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  graders: [hasFile('marker.txt', /nope/)],
  task: async (c) => {
    // A session keeps the workspace hasFile reads; the exec starts one.
    await c.exec('true')
  },
})
