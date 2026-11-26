import { defineEval, regression } from 'reeval'
import { succeeded } from 'reeval/graders'
import { plain } from './environments.ts'

const greetsAda = `node -e "import('./greet.js').then((m) =>
  process.exit(m.greet('Ada') === 'Ahoy, Ada!' ? 0 : 1))"`

export default defineEval({
  environment: plain,
  graders: [succeeded('greets Ada in the house style')],
  target: regression(),
  task: async (c) => {
    await c.send('Create greet.js exporting greet(name) in our house style.')
    await c.exec(greetsAda, { label: 'greets Ada in the house style' })
  },
})
