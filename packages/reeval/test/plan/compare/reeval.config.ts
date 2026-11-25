import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: [fakeAgent({ id: 'a' }), fakeAgent({ id: 'b' })],
  profiles: {
    lean: { limit: { compare: { maxVariants: 1 } } },
    off: { limit: { compare: false } },
    none: { limit: { compare: { maxVariants: 0 } } },
    // A language-model judge answers the questions that name no model of their own.
    judged: { judge: { model: 'google/gemini-3.8-flash' } },
    one: { limit: { agents: ['a'] } },
    'one-lean': { limit: { agents: ['a'], compare: { maxVariants: 1 } } },
  },
})
