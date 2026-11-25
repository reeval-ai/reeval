import { defineEval, expect } from 'reeval'

// Must fail: docker({ root: true }) carries to the VM's container, so the shell isn't reeval's.
export default defineEval({
  task: async (c) => {
    const turn = await c.send('who am I')
    expect(turn.transcript.find((e) => e.type === 'tool')).toMatchObject({ output: 'reeval\n' })
  },
})
