import { defineEnvironment, defineEval, expect } from 'reeval'

const site = defineEnvironment('site', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: site,
  task: async (c) => {
    await c.send('Add a "Sign up" button under the intro paragraph in index.html.')

    await expect(c).toHaveFile('index.html', /Sign up/)
    // The page as a browser shows it: server.js serves index.html on $PORT.
    const app = await c.serve('node server.js')
    const home = await c.capture(app, { name: 'home' })
    const q = 'Does the screenshot show a button labeled "Sign up" under the intro paragraph?'
    expect(await c.judge(q, { artifacts: [home] })).toPass()
  },
})
