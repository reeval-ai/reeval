import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

// The model is the suite's scripted one: it picks each move from the history in its prompt.
export default defineEval({
  environment: ui,
  graders: [observed('state', (value) => value === 'ada@example.com')],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    await c.capture(server, {
      name: 'welcome',
      instructions: ['Sign up as ada@example.com with password Test1234!, then submit'],
    })
    const state = await c.exec(
      `node -e "fetch('http://127.0.0.1:${server.port}/state').then(r=>r.text()).then(t=>process.stdout.write(t))"`,
    )
    c.observe('state', state.stdout)
  },
})
