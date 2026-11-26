import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { repo } from './env.ts'

// Must fail: the source repository's history (two commits) isn't copied in, only its tree.
export default defineEval({
  environment: repo,
  graders: [observed<string>('git', (out) => out === '2\n')],
  task: async (c) => {
    const r = await c.exec('git rev-list --count HEAD && git status --porcelain && git remote')
    c.observe('git', r.stdout)
  },
})
