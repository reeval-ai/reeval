import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

export default defineEval({
  // The mistake: file() never resolves from the current directory.
  graders: [
    observed<string | null>(
      'marker.txt',
      (text) => !!text?.includes('from the current directory\n'),
    ),
  ],
  task: async (c) => {
    await c.exec('true')
    c.observe('marker.txt', await c.readFile('marker.txt'))
  },
})
