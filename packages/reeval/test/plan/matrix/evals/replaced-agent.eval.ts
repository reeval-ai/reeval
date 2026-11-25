import { defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineEval({ agents: fakeAgent({ id: 'c' }), task: async () => {} })
