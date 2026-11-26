import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'
import { LOG, stamp } from './env.ts'

export default defineEval({
  environment: stamp,
  graders: [succeeded('tool called')],
  task: async (c) => {
    // The mistake: with no turn, nothing has called the tool.
    await c.exec(`grep -q tools/call ${LOG}`, { label: 'tool called' })
  },
})
