import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { fakeInstructions } from 'reeval/testing'
import { ui } from './env.ts'

// Lands fails on the unfinished instruction; this expects another wording.
export default defineEval({
  capture: { timeout: '10s' },
  environment: ui,
  graders: [observed<string>('error', (message) => message === 'still loading')],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    try {
      await c.capture(server, {
        name: 'late',
        instructions: fakeInstructions([[{ type: 'click', x: 1, y: 1 }]]),
      })
    } catch (error) {
      c.observe('error', (error as Error).message)
    }
  },
})
