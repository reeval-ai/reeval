import { defineEval } from 'reeval'
import { agentPrinted, listed } from './env.ts'

// An unlisted host gets a refusal that says why, and the trial goes on to its checks.
export default defineEval({
  environment: listed,
  graders: [
    agentPrinted(
      'says-why',
      ([body]) =>
        body?.trim() ===
        "blocked by the reeval egress policy: blocked.invalid isn't in the allowlist",
    ),
  ],
  task: async (c) => {
    await c.send('fetch an unlisted host')
  },
})
