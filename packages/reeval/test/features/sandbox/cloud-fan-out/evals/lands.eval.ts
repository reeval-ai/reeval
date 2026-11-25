import { defineEval, expect } from 'reeval'

// Each attempt is docker()'s container, as root, on a VM of its own.
export default defineEval({
  runs: 2,
  task: async (c) => {
    const turn = await c.send('who am I')
    expect(turn.transcript.find((e) => e.type === 'tool')).toMatchObject({ output: 'root\n' })
  },
})
