import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// Each trial is docker()'s container, as root, on a VM of its own.
export default defineEval({
  trials: 2,
  graders: [observed('shell-output', (out) => out === 'root\n')],
  task: async (c) => {
    const turn = await c.send('who am I')
    c.observe('shell-output', turn.trajectory.find((e) => e.type === 'tool')?.output ?? null)
  },
})
