import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { otherFile } from '../layout.ts'
import { houseRules } from './env.ts'

// Must fail: the rules go to the harness's own file only, not the other agents'.
export default defineEval({
  environment: houseRules,
  graders: [hasFile(otherFile, 'Always write tests.')],
  task: async (c) => {
    await c.exec('true')
  },
})
