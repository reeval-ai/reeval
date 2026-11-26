import { defineEval, regression } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

const greetsAda = `node -e "import('./lib/greet.js').then((m) =>
  process.exit(m.greet('Ada') === 'Hello, Ada!' ? 0 : 1))"`

export default defineEval({
  graders: [hasFile('src/greet.js', /export/, { required: true }), succeeded('greets Ada')],
  target: regression(),
  task: async (c) => {
    await c.send('Create lib/greet.js exporting greet(name), which returns "Hello, <name>!".')
    await c.exec(greetsAda, { label: 'greets Ada' })
  },
})
