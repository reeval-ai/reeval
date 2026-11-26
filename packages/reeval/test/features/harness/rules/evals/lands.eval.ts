import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { rulesFile } from '../layout.ts'
import { houseRules } from './env.ts'

// `rules` become the workspace file the harness reads, word for word.
export default defineEval({
  environment: houseRules,
  graders: [hasFile(rulesFile, 'Always write tests.')],
  task: async (c) => {
    await c.exec('true')
  },
})
