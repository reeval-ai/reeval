import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, plain } from './env.ts'

// The agent and checks run as the unprivileged `reeval` user (uid 10001), with no capabilities.
export default defineEval({
  environment: plain,
  graders: [observed('ids', (ids) => ids === '10001 0000000000000000 / 10001')],
  task: async (c) => {
    const [agent] = agentSaw(await c.send('who are you'))
    const check = (await c.exec('id -u')).stdout
    c.observe('ids', `${agent?.trim()} / ${check.trim()}`)
  },
})
