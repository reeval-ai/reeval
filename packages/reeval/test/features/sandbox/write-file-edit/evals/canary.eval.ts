import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting, hidden } from './env.ts'

// Wrong: the agent's edit to a placed file is a modification, not a new file.
export default defineEval({
  environment: greeting,
  graders: [
    observed<string[]>(
      'statuses',
      (s) => JSON.stringify(s) === JSON.stringify(['added', 'modified']),
    ),
  ],
  task: async (c) => {
    await c.send('Create greet.js.')
    await c.writeFile('test/hidden.test.js', hidden)
    await c.writeFile('.cache/grade.js', hidden)
    const turn = await c.send('Make the hidden test pass.')
    const status = (path: string) => turn.diff.files.find((f) => f.path === path)?.status ?? null
    c.observe('statuses', [status('test/hidden.test.js'), status('.cache/grade.js')])
  },
})
