import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  graders: [
    observed<{ path: string; name: string; bytes: number }>(
      'home',
      (shot) => shot.path === 'artifacts/home.png' && shot.name === 'home' && shot.bytes > 0,
    ),
  ],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const shot = await c.capture(server, { name: 'home' })
    c.observe('home', { path: shot.file.path, name: shot.name, bytes: shot.file.bytes })
  },
})
