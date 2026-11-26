import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, vm } from './env.ts'

// Each slot is its own user, with its own workspace, home and gateway port: slot 0 is the layout
// a machine of its own has, slot 1 the same names with -s1, and each sees its home at slot 0's.
export default defineEval({
  environment: vm,
  graders: [
    observed<string[]>('agent-saw', ([user, cwd, home, proxy]) => {
      const slot = user === 'reeval' ? 0 : 1
      const s = slot ? '-s1' : ''
      return (
        JSON.stringify([user, cwd, home, proxy]) ===
        JSON.stringify([
          `reeval${s}`,
          `/reeval${s}/workspace`,
          '/home/reeval',
          `http://127.0.0.1:${24128 + slot}`,
        ])
      )
    }),
  ],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('where am I')))
  },
})
