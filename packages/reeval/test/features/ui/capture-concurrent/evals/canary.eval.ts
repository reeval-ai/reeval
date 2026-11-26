import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  graders: [observed<{ path: string }>('home', (shot) => shot.path === 'artifacts/wrong.png')],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const [home] = await Promise.all([
      c.capture(server, { name: 'home' }),
      c.capture(server, { name: 'about', path: '/about' }),
    ])
    c.observe('home', { path: home.file.path, bytes: home.file.bytes })
  },
})
