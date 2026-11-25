import { defineEval, expect } from 'reeval'
import { listed, plugins } from './env.ts'

// plugin.marketplace places the entry it names, read from the marketplace's repository.
export default defineEval({
  environment: listed,
  task: async (c) => {
    expect((await c.exec(`cat ${plugins}/review/agents/reviewer.md`)).stdout).toContain(
      'Review the diff for the house style.',
    )
  },
})
