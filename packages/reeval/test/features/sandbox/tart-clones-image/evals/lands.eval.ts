import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { mac } from './env.ts'

// The VM is a clone of the image Tart already had: the run pulled nothing.
export default defineEval({
  environment: mac,
  graders: [observed('image', (image) => image === 'ghcr.io/cirruslabs/macos-sequoia-base:15.6')],
  task: async (c) => {
    c.observe('image', (await c.exec('cat ../../image')).stdout.trim())
  },
})
