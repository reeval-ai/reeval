import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { placed, unbuilt } from './env.ts'

// Must fail: this build writes nothing, so the built file is missing.
export default defineEval({
  environment: unbuilt,
  graders: [
    observed<string>('built.txt', (text) => text.includes('built from the acme-tools marketplace')),
  ],
  task: async (c) => {
    c.observe('built.txt', (await c.exec(`cat ${placed}/dist/built.txt`)).stdout)
  },
})
