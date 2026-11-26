import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { placed, review } from './env.ts'

// plugin.local copies the plugin's kept parts into the sandbox: its subagent is there.
export default defineEval({
  environment: review,
  graders: [
    observed<string>('reviewer.md', (text) =>
      text.includes('Review the diff for the house style.'),
    ),
  ],
  task: async (c) => {
    c.observe('reviewer.md', (await c.exec(`cat ${placed}/agents/reviewer.md`)).stdout)
  },
})
