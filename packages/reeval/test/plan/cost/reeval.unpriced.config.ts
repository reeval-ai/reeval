import { defineConfig } from 'reeval'
import { cursor, fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: [cursor({ model: 'my-model' }), cursor({ model: 'gpt-5.6-luna-high' }), fakeAgent()],
  judge: { model: 'typesafe-ai/jev' },
})
