import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, plain, TOOL } from './env.ts'

// A `from` image's `ENV PATH` survives Debian's /etc/profile in the agent's login shells.
export default defineEval({
  environment: plain,
  graders: [observed('agent-saw', (saw) => saw === `${TOOL}\n${TOOL}`)],
  task: async (c) => {
    const [agent] = agentSaw(await c.send('find the tool'))
    c.observe('agent-saw', agent?.trim() ?? null)
  },
})
