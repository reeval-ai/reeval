import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { built } from './env.ts'

// Under Cursor's layout, a built plugin's subagent is unpacked from the build's output, not from
// the source the plan read.
export default defineEval({
  environment: built,
  graders: [hasFile('.cursor/agents/reviewer.md', 'BUILT-41')],
  task: async (c) => {
    await c.exec('true')
  },
})
