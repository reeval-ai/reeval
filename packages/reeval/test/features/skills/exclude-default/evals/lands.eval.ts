import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting, listStaged } from './env.ts'

// With no exclude, a top-level evals/, .history/ and *.eval.ts stay out; a nested evals/ lands.
export default defineEval({
  environment: greeting,
  graders: [
    observed<string[]>(
      'staged-files',
      (files) =>
        JSON.stringify(files) ===
        JSON.stringify(['./SKILL.md', './docs/evals/checklist.md', './docs/tone.md']),
    ),
  ],
  task: async (c) => {
    const files = (await c.exec(listStaged)).stdout.trim().split('\n')
    c.observe('staged-files', files)
  },
})
