import { defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { direct } from 'reeval/gateway'

export default defineEval({
  agents: fakeAgent({ id: 'b', gateway: direct() }),
  task: async () => {},
})
