import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, plain } from './env.ts'

// The snapshot is root's, mode 0700: the `reeval` user the agent runs as can't open it.
export default defineEval({
  environment: plain,
  graders: [observed('agent-saw', (saw) => saw === 'refused')],
  task: async (c) => {
    const [agent] = agentSaw(await c.send('Read the snapshot.'))
    c.observe('agent-saw', agent?.trim() ?? null)
  },
})
