import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

// Wrong artifact name: the check must be able to fail.
export default defineEval({
  environment: ui,
  graders: [
    observed<{ path: string }>('after-submit', (shot) => shot.path === 'artifacts/wrong.png'),
  ],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const shot = await c.capture(server, {
      name: 'after-submit',
      instructions: ['Fill in the sign-in form and submit'],
    })
    c.observe('after-submit', { path: shot.file.path, name: shot.name, bytes: shot.file.bytes })
  },
})
