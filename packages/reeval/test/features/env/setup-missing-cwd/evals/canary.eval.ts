import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { present } from './env.ts'

// Must fail: a step whose cwd exists runs there.
export default defineEval({
  environment: present,
  graders: [hasFile('sub/ran', { name: 'no-file-sub-ran', score: (has) => (has ? 0 : 1) })],
  task: async (c) => {
    await c.exec('true')
  },
})
