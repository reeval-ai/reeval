import { defineEnvironment, defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'

const phased = defineEnvironment('phased', { egress: { setup: 'allow-all', agent: 'deny-all' } })
const setupOnly = defineEnvironment('setup-only', { egress: { setup: 'allow-all' } })
const closed = defineEnvironment('closed', { egress: 'deny-all' })
const reopened = closed.extendEnvironment('reopened', { egress: { setup: 'allow-all' } })
const same = defineEnvironment('same', { egress: { setup: 'deny-all', agent: 'deny-all' } })

export default defineEval({
  compare: { control: closed, variants: [reopened] },
  task: async () => {},
})
