import { defineEnvironment, defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'

// The agent starts from the small package in ./project, README.md included.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

// Says yes only when README.md reaches the judge and mentions multiply, so a wrong `contents` (a
// mistyped path, say) fails here, before a real judge costs anything. The grader sends no
// captures, so the state is one JSON object.
const readsReadme = fakeJudge({
  score: (state) => {
    const { contents } = state as { contents?: Record<string, string | null> }
    return contents?.['README.md']?.includes('multiply') ? 1 : 0
  },
})

export default defineEval({
  environment: math,
  graders: [
    judge('Does README.md document multiply?', {
      inputs: { contents: ['README.md'] },
      model: readsReadme,
    }),
  ],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, and document it in README.md.')
  },
})
