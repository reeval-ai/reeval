import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// A file the shell wrote is in the workspace diff, though no edit tool touched it. The eval's own
// write before the turn is in the diff too, but not in the turn's files changed.
export default defineEval({
  graders: [
    observed<Array<{ path: string; status: string }>>(
      'diff-files',
      (files) =>
        JSON.stringify(files) ===
        JSON.stringify([
          { path: 'note.txt', status: 'added' },
          { path: 'setup.txt', status: 'added' },
        ]),
    ),
  ],
  task: async (c) => {
    await c.exec("printf 'from the eval\\n' > setup.txt")
    const turn = await c.send('write a note')
    c.observe('diff-files', turn.diff.files)
  },
})
