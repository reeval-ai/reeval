import { defineEnvironment, evaluate } from 'reeval'
import { docker } from 'reeval/sandbox'

const plain = defineEnvironment('plain', { sandbox: docker() })
const rooted = defineEnvironment('rooted', {
  sandbox: docker({ from: 'debian:12', root: true, memory: '2g' }),
})

evaluate('builds the app', { environments: [plain, rooted] }, async () => {})
