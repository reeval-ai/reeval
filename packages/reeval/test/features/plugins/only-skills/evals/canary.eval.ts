import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { placed, review } from './env.ts'

// Must fail: only: ['skills'] leaves the plugin's subagent out.
export default defineEval({
  environment: review,
  graders: [
    observed<string>('reviewer.md', (text) =>
      text.includes('Review the diff for the house style.'),
    ),
  ],
  task: async (c) => {
    await c.send('Lint the change.')
    c.observe('reviewer.md', (await c.exec(`cat ${placed}/agents/reviewer.md`)).stdout)
  },
})
