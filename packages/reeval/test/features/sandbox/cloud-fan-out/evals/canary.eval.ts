import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// Must fail: docker({ root: true }) carries to the VM's container, so the shell isn't reeval's.
export default defineEval({
  graders: [observed('shell-output', (out) => out === 'reeval\n')],
  task: async (c) => {
    const turn = await c.send('who am I')
    c.observe('shell-output', turn.transcript.find((e) => e.type === 'tool')?.output ?? null)
  },
})
