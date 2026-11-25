import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const plain = defineEnvironment('plain', { sandbox: docker() })
const rooted = defineEnvironment('rooted', {
  sandbox: docker({ from: 'debian:12', root: true, memory: '2g' }),
})

export default defineEval({ environment: [plain, rooted], task: async () => {} })
