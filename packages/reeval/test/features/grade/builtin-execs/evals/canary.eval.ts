import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  graders: [succeeded('tests')],
  task: async (c) => {
    await c.send('build it')
    // The mistake: the tests exit 3.
    await c.exec('exit 3', { label: 'tests' })
  },
})
