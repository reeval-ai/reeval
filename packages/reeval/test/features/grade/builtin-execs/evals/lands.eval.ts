import { defineEval } from 'reeval'
import { observed, succeeded } from 'reeval/graders'
import { plain } from './env.ts'

// Stored c.exec results, by label or command, and observations.
export default defineEval({
  environment: plain,
  graders: [
    succeeded('tests', { required: true }),
    succeeded('echo built'),
    observed<number>('health', (status) => status === 200),
    observed('ready'),
    observed('lines'),
  ],
  task: async (c) => {
    await c.send('build it')
    await c.exec('exit 0', { label: 'tests' })
    await c.exec('echo built')
    c.observe('health', 200)
    c.observe('ready', true)
    c.observe('lines', 3)
  },
})
