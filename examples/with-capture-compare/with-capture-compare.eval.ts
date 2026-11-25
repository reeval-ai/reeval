import { defineEnvironment, defineEval, expect } from 'reeval'

const site = defineEnvironment('site', ({ directory }) => ({ files: directory('./project') }))
const withBrand = site.extendEnvironment('brand', ({ skill }) => ({
  skills: [skill.local('./skills/brand')],
}))

export default defineEval({
  compare: { control: site, variants: [withBrand] },
  questions: [
    {
      question: 'Which Sign up button is blue with white text and rounded corners?',
      across: 'environment',
      diff: true,
      artifacts: ['home'],
    },
  ],
  task: async (c) => {
    await c.send('Add a "Sign up" button under the intro paragraph in index.html.')

    await expect(c).toHaveFile('index.html', /Sign up/)
    // server.js serves index.html on $PORT.
    const app = await c.serve('node server.js')
    await c.capture(app, { name: 'home' })
  },
})
