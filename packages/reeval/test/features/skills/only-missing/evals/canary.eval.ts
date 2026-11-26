import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { picked } from './env.ts'

// Must fail: with a name that is there, only that skill is staged, not its sibling.
export default defineEval({
  environment: picked,
  graders: [
    observed<string[]>(
      'staged-skills',
      (staged) => JSON.stringify(staged) === JSON.stringify(['house-farewell', 'house-greeting']),
    ),
  ],
  task: async (c) => {
    const staged = (await c.exec('ls .agents/skills')).stdout.trim().split('\n')
    c.observe('staged-skills', staged)
  },
})
