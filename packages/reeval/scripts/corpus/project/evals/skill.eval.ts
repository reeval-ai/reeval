import { defineEnvironment, defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

const plain = defineEnvironment('plain', {})
const withHouseGreeting = defineEnvironment('with-house-greeting', ({ skill }) => ({
  skills: [skill.local('../skills/house-greeting')],
}))

// Both arms write greet.js, so the first pairwise question has votes and the second fails at the
// model. Each attempt is asked the last two on its own: one picks from choices, one answers in
// words. One grader is named and one keeps its default name. Two values are observed.
export default defineEval({
  compare: { control: plain, variants: [withHouseGreeting] },
  questions: [
    {
      question: 'Which greeting reads more like our house style?',
      across: 'environment',
      diff: true,
    },
    { question: 'Which greeting handles a missing name?', across: 'environment', diff: true },
    { question: 'Does the greeting use the house style?', choices: ['yes', 'no'], diff: true },
    { question: 'How did the agent pick its greeting?', trajectory: true },
  ],
  graders: [hasFile('greet.js', { name: 'writes greet.js' }), hasFile('greet.js', /=>/)],
  task: async (c) => {
    await c.send('Write greet.js that greets in our house style.')
    const greet = (await c.readFile('greet.js')) ?? ''
    c.observe('greeting', greet.includes('Ahoy') ? 'ahoy' : 'hello')
    c.observe('lines', greet.split('\n').length)
  },
})
