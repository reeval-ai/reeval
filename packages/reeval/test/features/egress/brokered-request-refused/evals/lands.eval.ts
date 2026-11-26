import { defineEval } from 'reeval'
import { agentPrinted, brokered } from './env.ts'

// The brokered key off its endpoints gets the gateway's refusal, which says why.
export default defineEval({
  environment: brokered,
  graders: [
    agentPrinted(
      'says-why',
      ([body]) =>
        body?.trim() ===
        "reeval egress gateway: refused GET https://api.openai.com/v1/models. It carries a brokered credential, and it isn't one of the endpoints reeval brokers it for.",
    ),
  ],
  task: async (c) => {
    await c.send('search the web')
  },
})
