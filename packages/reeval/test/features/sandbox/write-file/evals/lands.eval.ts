import { defineEval, expect } from 'reeval'
import { greeting, hidden } from './env.ts'

export default defineEval({
  environment: greeting,
  task: async (c) => {
    await c.send('Create greet.js.')
    await c.writeFile('test/hidden.test.js', hidden)
    await c.writeFile('.cache/grade.js', hidden)
    const turn = await c.send('Write notes.md.')
    expect(turn.diff.files.map((f) => f.path).sort()).toEqual(['greet.js', 'notes.md'])
  },
})
