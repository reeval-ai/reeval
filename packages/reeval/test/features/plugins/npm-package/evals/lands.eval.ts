import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { pinned, stamped } from './env.ts'

// plugin.npm places the pinned version, and its MCP server joins the environment as review:docs.
export default defineEval({
  environment: pinned,
  graders: [observed('stamp', (stamp) => stamp === 'STAMP-7Q')],
  task: async (c) => {
    c.observe('stamp', stamped(await c.send('Stamp it.')))
  },
})
