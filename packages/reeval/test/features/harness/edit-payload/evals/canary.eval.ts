import { evaluate, expect } from 'reeval'
import { plain } from './env.ts'

evaluate('canary', { environments: plain }, async (c) => {
  const turn = await c.send('write a big file')
  const edit = turn.transcript.find((e) => e.type === 'file-edit')
  // The fake agent's edit output is what its model saw, not the full view.
  expect(edit).toMatchObject({ input: { path: 'big.txt' }, outputView: 'full' })
})
