import { evaluate, expect } from 'reeval'
import { plain } from './env.ts'

evaluate('lands', { environments: plain }, async (c) => {
  const turn = await c.send('write a big file')
  const edit = turn.transcript.find((e) => e.type === 'file-edit')
  expect(edit).toMatchObject({
    input: { path: 'big.txt', content: expect.stringMatching(/^x{200000}\n$/) },
    output: 'Wrote big.txt',
    outputView: 'model',
  })
})
