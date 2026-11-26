import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  graders: [
    observed<{ path: string; bytes: number }>(
      'home',
      (shot) => shot.path === 'artifacts/home.png' && shot.bytes > 0,
    ),
    observed<{ path: string; bytes: number }>(
      'about',
      (shot) => shot.path === 'artifacts/about.png' && shot.bytes > 0,
    ),
  ],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const [home, about] = await Promise.all([
      c.capture(server, { name: 'home' }),
      c.capture(server, { name: 'about', path: '/about' }),
    ])
    c.observe('home', { path: home.file.path, bytes: home.file.bytes })
    c.observe('about', { path: about.file.path, bytes: about.file.bytes })
  },
})
