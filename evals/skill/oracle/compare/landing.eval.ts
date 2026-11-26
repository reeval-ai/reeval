import { defineEnvironment, defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

const plain = defineEnvironment('plain', {})
const design = plain.extendEnvironment('design', ({ skill }) => ({
  skills: [skill.local('../skills/design')],
}))

export default defineEval({
  compare: { control: plain, variants: [design] },
  questions: [
    {
      question: 'Which landing page follows the design guidelines more closely?',
      across: 'environment',
      artifacts: ['home'],
    },
  ],
  runs: 2,
  graders: [hasFile('index.html', /Acme Notes/, { name: 'writes-index-html' })],
  task: async (c) => {
    await c.send('Build a one-page landing site for Acme Notes in index.html. No dependencies.')
    const site = await c.serve('npx -y serve@14 -l $PORT', 3000)
    await c.capture(site, { name: 'home' })
  },
})
