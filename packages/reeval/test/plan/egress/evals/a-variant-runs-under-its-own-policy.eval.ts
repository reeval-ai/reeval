import { DEFAULT_EGRESS_ALLOW, defineEnvironment, defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'

const closed = defineEnvironment('closed', { egress: 'deny-all' })
const reopened = closed.extendEnvironment('reopened', { egress: 'allow-all' })
const installs = defineEnvironment('installs', {
  egress: { allow: [...DEFAULT_EGRESS_ALLOW, 'api.example.com'] },
})
const plain = defineEnvironment('plain', {})

export default defineEval({
  compare: { baseline: plain, variants: [closed] },
  task: async () => {},
})
