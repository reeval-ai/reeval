import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  graders: [
    observed<{ path: string; viewport: string }>(
      'tall',
      (shot) => shot.path === 'artifacts/tall.png' && shot.viewport === 'full-page',
    ),
  ],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const shot = await c.capture(server, { name: 'tall', viewport: 'full-page' })
    c.observe('tall', { path: shot.file.path, viewport: shot.viewport })
  },
})
