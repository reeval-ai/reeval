import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, rooted } from './env.ts'

// Must fail: with docker({ root: true }) both run as root, with the capabilities apt-get needs.
export default defineEval({
  environment: rooted,
  graders: [observed('ids', (ids) => ids === '10001 0000000000000000 / 10001')],
  task: async (c) => {
    const [agent] = agentSaw(await c.send('who are you'))
    const check = (await c.exec('id -u')).stdout
    c.observe('ids', `${agent?.trim()} / ${check.trim()}`)
  },
})
