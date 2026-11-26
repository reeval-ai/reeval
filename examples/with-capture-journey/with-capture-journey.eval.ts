import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, judge } from 'reeval/graders'

const pricing = defineEnvironment('pricing', ({ directory }) => ({ files: directory('./project') }))

// The journey's model, named so the same one clicks under every profile. Without it, each
// profile's judge would, and fx's (Jev) can't.
const journey = { model: 'anthropic/claude-sonnet-5' }

export default defineEval({
  environment: pricing,
  capture: journey,
  graders: [
    hasFile('index.html', /addEventListener|onclick/, { name: 'click-handler' }),
    judge('Does the screenshot show "$12 a month"?', { inputs: { artifacts: ['after-click'] } }),
  ],
  task: async (c) => {
    await c.send('The "Show price" button in index.html does nothing. Make it reveal the price.')

    const app = await c.serve('node server.js')
    // A vision model clicks the button, as a person would, before the screenshot. Each move sees
    // only the goal and the page, so the goal says when it's met.
    await c.capture(app, {
      name: 'after-click',
      instructions: [
        'Click "Show price" if no price shows under it yet; once one shows, you are done',
      ],
    })
  },
})
