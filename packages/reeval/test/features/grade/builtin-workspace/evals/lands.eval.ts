import { defineEval } from 'reeval'
import { hasFile, inDiff, notInDiff } from 'reeval/graders'
import { app } from './env.ts'

// The final diff and workspace, with no files declared: hasFile keeps its own.
export default defineEval({
  environment: app,
  graders: [
    hasFile('src/retry.ts', /export function retry/, { required: true }),
    hasFile('src/missing.ts', { weight: 0 }),
    inDiff('src/**'),
    notInDiff('test/**/*.test.ts', { required: true }),
    // A dependency directory is one entry in the diff, live and regraded alike.
    inDiff('**/*.js', { weight: 0 }),
    notInDiff('**/package.json', { required: true }),
  ],
  task: async (c) => {
    await c.send('add retry')
  },
})
