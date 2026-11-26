import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting, listStaged } from './env.ts'

// A custom exclude replaces the defaults: its patterns stay out, and evals/ lands.
export default defineEval({
  environment: greeting,
  graders: [
    observed<string[]>(
      'staged-files',
      (files) =>
        JSON.stringify(files) ===
        JSON.stringify(['./SKILL.md', './docs/tone.md', './evals/prompts.md']),
    ),
  ],
  task: async (c) => {
    const files = (await c.exec(listStaged)).stdout.trim().split('\n')
    c.observe('staged-files', files)
  },
})
