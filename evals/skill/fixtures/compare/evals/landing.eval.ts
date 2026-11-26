import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

export default defineEval({
  graders: [hasFile('index.html', /Acme Notes/, { name: 'writes-index-html' })],
  task: async (c) => {
    await c.send('Build a one-page landing site for Acme Notes in index.html. No dependencies.')
    const site = await c.serve('npx -y serve@14 -l $PORT', 3000)
    await c.capture(site, { name: 'home' })
  },
})
