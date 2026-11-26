import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { repo } from './env.ts'

// The workspace is a git repository: one commit of the fetched tree, clean, with no remote.
export default defineEval({
  environment: repo,
  graders: [observed<string>('git', (out) => out === '1\n')],
  task: async (c) => {
    const r = await c.exec('git rev-list --count HEAD && git status --porcelain && git remote')
    c.observe('git', r.stdout)
  },
})
