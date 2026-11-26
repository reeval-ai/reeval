import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, plain } from './env.ts'

// Must fail: Podman's own seccomp profile would let the unshare through.
export default defineEval({
  environment: plain,
  graders: [observed('agent-saw', (saw) => saw === 'exit=0')],
  task: async (c) => {
    const [agent] = agentSaw(await c.send('unshare'))
    c.observe('agent-saw', agent?.trim() ?? null)
  },
})
