import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { pins } from './env.ts'

// Checks see the values; the agent prints them too. The oracle then checks the record still
// reads, with its nulls and numbers (the 1234 lines the agent added) intact.
export default defineEval({
  environment: pins,
  graders: [observed('checks-saw-values')],
  task: async (c) => {
    await c.send('print PIN and PLACEHOLDER')
    const out = (await c.exec('printf "%s\\n" "$PIN" "$PLACEHOLDER"')).stdout
    c.observe('checks-saw-values', out === '1234\nnull\n')
  },
})
