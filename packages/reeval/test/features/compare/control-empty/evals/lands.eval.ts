import { defineEval, defineGrader } from 'reeval'
import { hasFile } from 'reeval/graders/match'
import { empty, variant } from './env.ts'

// The variant has its file, and only the variant.
const variantFile = defineGrader('variant-file', {
  files: ['from-variant.txt'],
  grade: async (c) =>
    (await hasFile(c, 'from-variant.txt')) === (c.observation('role') === 'variant'),
})

// An empty control runs without the variant's files.
export default defineEval({
  compare: { control: empty, variants: [variant] },
  graders: [variantFile],
  task: async (c) => {
    await c.exec('true')
    c.observe('role', c.attempt.cell.role)
  },
})
