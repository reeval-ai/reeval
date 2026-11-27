import { defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineEval({
  agents: fakeAgent({ id: 'broken', failWith: 'the fake sandbox fell over' }),
  task: async (c) => {
    await c.send('Write greet.js.')
  },
})
