import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { marked, plain } from './env.ts'

// The control has no marker and fails; the eval passes on the variant's lift.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  graders: [hasFile('marker.txt')],
  task: async (c) => {
    await c.send('look for the marker')
  },
})
