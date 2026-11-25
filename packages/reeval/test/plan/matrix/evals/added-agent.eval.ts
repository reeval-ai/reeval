import { defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineEval({
  agents: (h) => [...h, fakeAgent({ id: 'c' })],
  task: async () => {},
})
