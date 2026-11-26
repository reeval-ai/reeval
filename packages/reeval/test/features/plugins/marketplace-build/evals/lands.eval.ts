import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { built, placed } from './env.ts'

// The entry's build ran on the whole marketplace, and its output is placed with the plugin.
export default defineEval({
  environment: built,
  graders: [
    observed<string>('built.txt', (text) => text.includes('built from the acme-tools marketplace')),
  ],
  task: async (c) => {
    c.observe('built.txt', (await c.exec(`cat ${placed}/dist/built.txt`)).stdout)
  },
})
