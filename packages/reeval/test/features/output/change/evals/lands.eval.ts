import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { marked, plain } from './env.ts'

// Measure a change: a row per arm, `N of M` and the effect, then the graders that failed in some arm.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  graders: [hasFile('marker.txt')],
  task: async (c) => {
    // A session keeps the workspace hasFile reads; the exec starts one.
    await c.exec('true')
  },
})
