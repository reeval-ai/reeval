import { defineEval, expect } from 'reeval'
import { listed, plugins } from './env.ts'

// Must fail: the marketplace's other entry, lint, isn't placed.
export default defineEval({
  environment: listed,
  task: async (c) => {
    expect((await c.exec(`cat ${plugins}/lint/commands/lint.md`)).stdout).toContain(
      'Lint the tree for the house style.',
    )
  },
})
