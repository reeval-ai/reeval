import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { pinned, placed } from './env.ts'

// Must fail: only: ['skills', 'commands'] leaves the plugin's subagent out.
export default defineEval({
  environment: pinned,
  graders: [
    observed<string>('reviewer.md', (text) =>
      text.includes('Review the diff for the house style.'),
    ),
  ],
  task: async (c) => {
    c.observe('reviewer.md', (await c.exec(`cat ${placed}/agents/reviewer.md`)).stdout)
  },
})
