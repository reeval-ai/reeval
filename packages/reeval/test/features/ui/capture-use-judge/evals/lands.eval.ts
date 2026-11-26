import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  graders: [observed<{ path: string }>('journey', (shot) => shot.path === 'artifacts/journey.png')],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const shot = await c.capture(server, { name: 'journey', instructions: ['Open the menu'] })
    c.observe('journey', { path: shot.file.path, name: shot.name, bytes: shot.file.bytes })
  },
})
