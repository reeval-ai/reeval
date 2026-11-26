import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { marked, plain } from './env.ts'

// Must fail: the same misses under the config's regression() gate the variant.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  graders: [hasFile('marker.txt', /nope/)],
  task: async (c) => {
    // A session keeps the workspace hasFile reads; the exec starts one.
    await c.exec('true')
  },
})
