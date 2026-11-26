import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { pins } from './env.ts'

// Must fail: PLACEHOLDER prints too.
export default defineEval({
  environment: pins,
  graders: [observed('checks-saw-values')],
  task: async (c) => {
    await c.send('print PIN and PLACEHOLDER')
    const out = (await c.exec('printf "%s\\n" "$PIN" "$PLACEHOLDER"')).stdout
    c.observe('checks-saw', out)
    c.observe('checks-saw-values', out === '1234\n')
  },
})
