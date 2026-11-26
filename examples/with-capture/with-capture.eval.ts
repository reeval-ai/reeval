import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, judge } from 'reeval/graders'

const site = defineEnvironment('site', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: site,
  graders: [
    hasFile('index.html', /Sign up/),
    judge('Does the screenshot show a "Sign up" button under the intro paragraph?', {
      inputs: { artifacts: ['home'] },
    }),
  ],
  task: async (c) => {
    await c.send('Add a "Sign up" button under the intro paragraph in index.html.')

    // The page as a browser shows it: server.js serves index.html on $PORT.
    const app = await c.serve('node server.js')
    await c.capture(app, { name: 'home' })
  },
})
