import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, judge } from 'reeval/graders'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

// Set on the eval, so Jev judges it whichever profile runs: an eval's judge wins over a
// profile's. The version is pinned, since a new one can score the same work differently.
const jev = { model: 'typesafe-ai/jev-1.14.0' }

export default defineEval({
  environment: math,
  judge: jev,
  graders: [
    hasFile('README.md', /add\(/),
    judge('Could a new user call add correctly from README.md alone?', {
      inputs: { contents: ['README.md', 'src/math.js'] },
    }),
  ],
  task: async (c) => {
    await c.send('Write a README.md for this package: what it is and how to call add.')
  },
})
