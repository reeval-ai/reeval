import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, rooted } from './env.ts'

// Must fail: with docker({ root: true }) the agent is root, and root's directories are its own.
export default defineEval({
  environment: rooted,
  graders: [observed('agent-saw', (saw) => saw === 'refused')],
  task: async (c) => {
    const [agent] = agentSaw(await c.send('Read the snapshot.'))
    c.observe('agent-saw', agent?.trim() ?? null)
  },
})
