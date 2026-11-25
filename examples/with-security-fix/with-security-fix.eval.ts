import { readFileSync } from 'node:fs'
import { defineEnvironment, defineEval, expect } from 'reeval'

// The agent starts from ./project, where findUser() puts the name straight into its SQL.
const users = defineEnvironment('users', ({ directory }) => ({ files: directory('./project') }))
const exploit = readFileSync(new URL('./hidden/exploit.test.js', import.meta.url), 'utf8')

export default defineEval({
  environment: users,
  task: async (c) => {
    await c.send('findUser() in src/users.js is open to SQL injection. Fix it.')

    await expect(c.exec('node --test'), 'tests pass').toSucceed()
    await c.writeFile('test/exploit.test.js', exploit)
    await expect(c.exec('node --test test/exploit.test.js'), 'blocks the exploit').toSucceed()
  },
})
