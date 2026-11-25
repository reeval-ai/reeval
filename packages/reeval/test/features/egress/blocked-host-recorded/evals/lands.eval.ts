import { defineEval, expect } from 'reeval'
import { agentSaw, listed } from './env.ts'

// An unlisted host gets a refusal that says why, and the attempt goes on to its checks.
export default defineEval({
  environment: listed,
  task: async (c) => {
    const [body] = agentSaw(await c.send('fetch an unlisted host'))
    expect(body?.trim()).toBe(
      "blocked by the reeval egress policy: blocked.invalid isn't in the allowlist",
    )
  },
})
