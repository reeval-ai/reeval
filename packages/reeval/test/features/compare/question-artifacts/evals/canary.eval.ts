import { defineEval } from 'reeval'
import { pageStatus } from 'reeval/graders'
import { baseline, variant } from './env.ts'

export default defineEval({
  compare: { control: baseline, variants: [variant] },
  // The mistake: the task captured landing, not aside.
  graders: [pageStatus('aside', 200)],
  questions: [
    { question: 'Which page looks better?', across: 'environment', artifacts: ['landing'] },
  ],
  task: async (c) => {
    await c.send('write the page')
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'landing' })
  },
})
