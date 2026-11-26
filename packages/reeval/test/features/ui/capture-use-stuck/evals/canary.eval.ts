import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

// Lands fails on the stuck instruction; this expects another wording.
export default defineEval({
  environment: ui,
  graders: [observed<string>('error', (message) => message === 'still open')],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    try {
      await c.capture(server, { name: 'menu', instructions: ['Open the menu'] })
    } catch (error) {
      c.observe('error', (error as Error).message)
    }
  },
})
