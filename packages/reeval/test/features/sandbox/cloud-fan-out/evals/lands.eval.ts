import { evaluate, expect } from 'reeval'

// Each attempt is docker()'s container, as root, on a VM of its own.
evaluate('lands', { runs: 2 }, async (c) => {
  const turn = await c.send('who am I')
  expect(turn.transcript.find((e) => e.type === 'tool')).toMatchObject({ output: 'root\n' })
})
