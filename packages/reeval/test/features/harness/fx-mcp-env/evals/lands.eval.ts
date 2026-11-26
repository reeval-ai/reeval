import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { probed, probedLines, prompt, readLog } from './env.ts'

const reached = probedLines('reached', (lines) =>
  isDeepStrictEqual(lines, ['word=HERON-41', 'key=placeholder', 'fetched=reeval-egress-ok']),
)

// fx's stdio MCP server has the eval's variable, the secret's placeholder and the egress
// gateway: its fetch of the allowed listener got through.
export default defineEval({
  environment: probed,
  graders: [reached],
  task: async (c) => {
    await c.send(prompt)
    await c.exec(readLog)
  },
})
