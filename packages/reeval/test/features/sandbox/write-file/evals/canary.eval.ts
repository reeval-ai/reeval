import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting, hidden } from './env.ts'

// Placed with c.exec, so the next turn's diff has it.
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
    await c.exec(`mkdir -p test && printf %s ${JSON.stringify(hidden)} > test/hidden.test.js`)
    await c.writeFile('.cache/grade.js', hidden)
    const turn = await c.send('Write notes.md.')
    c.observe('diff', turn.diff.files.map((f) => f.path).sort())
  },
})
