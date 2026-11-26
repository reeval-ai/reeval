import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// Each attempt is docker()'s container, as root, on a VM of its own.
export default defineEval({
  runs: 2,
  graders: [observed('shell-output', (out) => out === 'root\n')],
  task: async (c) => {
    const turn = await c.send('who am I')
    c.observe('shell-output', turn.transcript.find((e) => e.type === 'tool')?.output ?? null)
  },
})
