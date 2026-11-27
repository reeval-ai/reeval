import { defineEval } from 'reeval'
import { pageStatus } from 'reeval/graders'
import { baseline, variant } from './env.ts'

// The question's calls are saved with the prompt (its token masked) and the landing capture's ref.
export default defineEval({
  compare: { baseline: baseline, variants: [variant] },
  graders: [pageStatus('landing', 200)],
  questions: [
    {
      question: 'Which page looks better?',
      across: 'environment',
      task: true,
      artifacts: ['landing'],
    },
  ],
  task: async (c) => {
    await c.send(`write the page for ${process.env.REEVAL_FIXTURE_TOKEN}`)
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'aside' })
    await c.capture(server, { name: 'landing' })
  },
})
