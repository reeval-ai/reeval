import { defineEval, expect } from 'reeval'
import { repo } from './env.ts'

// The workspace is a git repository: one commit of the fetched tree, clean, with no remote.
export default defineEval({
  environment: repo,
  task: async (c) => {
    const r = await c.exec('git rev-list --count HEAD && git status --porcelain && git remote')
    expect(r.stdout).toBe('1\n')
  },
})
