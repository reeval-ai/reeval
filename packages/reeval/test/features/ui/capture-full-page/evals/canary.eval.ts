import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

// Window size instead of the author key.
export default defineEval({
  environment: ui,
  graders: [
    observed<{ viewport: { width: number; height: number } }>(
      'tall',
      ({ viewport }) => viewport.width === 1280 && viewport.height === 720,
    ),
  ],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const shot = await c.capture(server, { name: 'tall', viewport: 'full-page' })
    c.observe('tall', { path: shot.file.path, viewport: shot.viewport })
  },
})
