import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { archived } from './env.ts'

// The mistake: it looks for a file the environment never writes, so its trial fails and keeps
// its files, which the archive must hold too.
export default defineEval({
  environment: archived,
  graders: [hasFile('missing.txt')],
  task: async (c) => {
    await c.send('look for the marker')
  },
})
