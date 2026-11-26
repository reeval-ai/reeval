import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { snapshots } from './env.ts'

export default defineEval({
  snapshot: { when: 'turns', compress: true },
  environment: snapshots,
  graders: [hasFile('app/built.js', 'built')],
  task: async (c) => {
    await c.send('build the app')
  },
})
