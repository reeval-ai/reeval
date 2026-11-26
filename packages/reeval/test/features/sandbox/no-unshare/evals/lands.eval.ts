import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, plain } from './env.ts'

// Docker's default seccomp profile, which podman() ships and passes too, refuses the agent a
// namespace of its own.
export default defineEval({
  environment: plain,
  graders: [
    observed(
      'agent-saw',
      (saw) => saw === 'unshare: unshare failed: Operation not permitted\nexit=1',
    ),
  ],
  task: async (c) => {
    const [agent] = agentSaw(await c.send('unshare'))
    c.observe('agent-saw', agent?.trim() ?? null)
  },
})
