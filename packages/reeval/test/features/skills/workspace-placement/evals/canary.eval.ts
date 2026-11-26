import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting } from './env.ts'

// Must fail: Cursor's directory isn't where the fake agent's workspace skills go.
export default defineEval({
  environment: greeting,
  graders: [
    observed<string[]>(
      'staged-files',
      (files) => JSON.stringify(files) === JSON.stringify(['./SKILL.md', './docs/tone.md']),
    ),
  ],
  task: async (c) => {
    const dir = '.cursor/skills/house-greeting'
    const files = (await c.exec(`cd ${dir} && find . -type f | LC_ALL=C sort`)).stdout
    c.observe('staged-files', files.trim().split('\n'))
  },
})
