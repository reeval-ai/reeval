import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting, hidden } from './env.ts'

export default defineEval({
  environment: greeting,
  graders: [
    observed<string[]>(
      'diff',
      (diff) => JSON.stringify(diff) === JSON.stringify(['greet.js', 'notes.md']),
    ),
  ],
  task: async (c) => {
    await c.send('Create greet.js.')
    await c.writeFile('test/hidden.test.js', hidden)
    await c.writeFile('.cache/grade.js', hidden)
    const turn = await c.send('Write notes.md.')
    c.observe('diff', turn.diff.files.map((f) => f.path).sort())
  },
})
