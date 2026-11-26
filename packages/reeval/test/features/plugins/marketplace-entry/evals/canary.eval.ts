import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { listed, plugins } from './env.ts'

// Must fail: the marketplace's other entry, lint, isn't placed.
export default defineEval({
  environment: listed,
  graders: [
    observed<string>('lint.md', (text) => text.includes('Lint the tree for the house style.')),
  ],
  task: async (c) => {
    c.observe('lint.md', (await c.exec(`cat ${plugins}/lint/commands/lint.md`)).stdout)
  },
})
