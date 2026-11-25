import { defineEval, expect } from 'reeval'
import { plain } from './environments.ts'

const greetsAda = `node -e "import('./greet.js').then((m) =>
  process.exit(m.greet('Ada') === 'Ahoy, Ada!' ? 0 : 1))"`

export default defineEval({
  environment: plain,
  task: async (c) => {
    await c.send('Create greet.js exporting greet(name) in our house style.')
    await expect(c.exec(greetsAda), 'greets Ada in the house style').toSucceed()
  },
})
