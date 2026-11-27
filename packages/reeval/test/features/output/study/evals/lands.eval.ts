import { capability, defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { marked, plain } from './env.ts'

// A study: capability() only reports, so its misses in both arms fail the eval, never the run.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  target: capability(),
  graders: [hasFile('marker.txt', /nope/)],
  task: async (c) => {
    // A session keeps the workspace hasFile reads; the exec starts one.
    await c.exec('true')
  },
})
