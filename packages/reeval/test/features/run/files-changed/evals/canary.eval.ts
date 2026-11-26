import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// Must fail: the shell's write is in the diff, so it isn't empty.
export default defineEval({
  graders: [observed<unknown[]>('diff-files', (files) => files.length === 0)],
  task: async (c) => {
    await c.exec("printf 'from the eval\\n' > setup.txt")
    const turn = await c.send('write a note')
    c.observe('diff-files', turn.diff.files)
  },
})
