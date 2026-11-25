import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Requested high, served medium: the record keeps both. id stays `fake` so the fixture
// runner's attempt keys stay `fake/<env>/<sandbox>#1`. The plan case holds default ids.
export default defineConfig({
  agents: fakeAgent({
    id: 'fake',
    effort: 'high',
    servedModel: 'fake-1[effort=medium]',
    text: 'done',
  }),
})
