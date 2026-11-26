import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { mac } from './env.ts'

// Must fail: the clone's image is the pinned one, not latest.
export default defineEval({
  environment: mac,
  graders: [observed('image', (image) => image === 'ghcr.io/cirruslabs/macos-sequoia-base:latest')],
  task: async (c) => {
    c.observe('image', (await c.exec('cat ../../image')).stdout.trim())
  },
})
