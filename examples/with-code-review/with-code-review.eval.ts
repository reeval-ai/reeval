import { defineEnvironment, defineEval, regression } from 'reeval'
import { judge, notInDiff } from 'reeval/graders'

// The agent starts from ./project, where page() has an off-by-one.
const app = defineEnvironment('search', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: app,
  target: regression(1),
  graders: [
    // A review edits nothing: a trial that fixes the bug instead scores 0.
    notInDiff('**', { required: true }),
    judge('Does the review find that page() is off by one, so page 1 skips items?', {
      inputs: { output: true },
      required: true,
    }),
  ],
  task: async (c) => {
    await c.send(
      'Review the code in src/ for bugs and reply with what you find. Do not edit files.',
    )
  },
})
