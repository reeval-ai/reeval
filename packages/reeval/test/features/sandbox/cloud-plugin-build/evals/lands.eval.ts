import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { built, placed } from './env.ts'

// The build ran in the image layer on the VM, as root, and its output is placed with the plugin.
export default defineEval({
  environment: built,
  graders: [observed<string>('built.txt', (text) => text.includes('built on linux as uid 0'))],
  task: async (c) => {
    c.observe('built.txt', (await c.exec(`cat ${placed}/dist/built.txt`)).stdout)
  },
})
