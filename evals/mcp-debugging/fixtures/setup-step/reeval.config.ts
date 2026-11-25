import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

const count = `import { readFileSync } from 'node:fs'

const users = JSON.parse(readFileSync('data/users.json', 'utf8'))
console.log(users.length)
`

export default defineConfig({
  agents: fakeAgent({
    files: { 'count.js': count },
    text: 'Created count.js.',
  }),
  sandbox: fakeSandbox(),
})
