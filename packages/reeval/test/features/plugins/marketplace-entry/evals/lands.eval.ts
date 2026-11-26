import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { listed, plugins } from './env.ts'

// plugin.marketplace places the entry it names, read from the marketplace's repository.
export default defineEval({
  environment: listed,
  graders: [
    observed<string>('reviewer.md', (text) =>
      text.includes('Review the diff for the house style.'),
    ),
  ],
  task: async (c) => {
    c.observe('reviewer.md', (await c.exec(`cat ${plugins}/review/agents/reviewer.md`)).stdout)
  },
})
