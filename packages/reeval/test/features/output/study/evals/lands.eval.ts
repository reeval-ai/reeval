import { defineEval, metric } from 'reeval'
import { hasFile } from 'reeval/graders'
import { marked, plain } from './env.ts'

// A study: metric() gates nothing, so its misses in both arms leave it `ran`, never `pass`.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  target: metric(),
  graders: [hasFile('marker.txt', /nope/)],
  task: async (c) => {
    // A session keeps the workspace hasFile reads; the exec starts one.
    await c.exec('true')
  },
})
