import { defineEval } from 'reeval'
import { hasFile, inDiff } from 'reeval/graders'
import { quality, says } from './graders.ts'
export default defineEval({
  graders: [says, quality, inDiff('out.txt', { required: true }), hasFile('out.txt')],
  task: async (c) => void (await c.send('write it')),
})
