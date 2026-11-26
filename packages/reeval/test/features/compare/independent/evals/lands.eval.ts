import { defineEval } from 'reeval'
import { baseline, variant } from './env.ts'
import { ownFile } from './graders.ts'

// Each cell is only its own files. The parent's environment is not applied.
export default defineEval({
  compare: { control: baseline, variants: [variant] },
  graders: [ownFile],
  task: async (c) => {
    await c.exec('true')
  },
})
