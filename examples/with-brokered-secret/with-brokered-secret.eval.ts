import { defineEnvironment, defineEval } from 'reeval'
import { observed, succeeded } from 'reeval/graders'

// The sandbox holds a placeholder. The egress gateway swaps in the real key only on HTTPS
// requests to Gemini's API, so the agent's code works and the key never enters the container.
const gemini = defineEnvironment('gemini', ({ secret }) => ({
  env: {
    GEMINI_API_KEY: secret.fromEnv('GOOGLE_GENERATIVE_AI_API_KEY', {
      hosts: secret.hosts.gemini,
    }),
  },
}))

export default defineEval({
  environment: gemini,
  graders: [succeeded('node models.js'), observed('placeholder')],
  task: async (c) => {
    await c.send(
      'Write models.js, a Node script that lists the Gemini API models with fetch and prints how ' +
        'many there are. Read the key from GEMINI_API_KEY and send it in the x-goog-api-key header.',
    )

    await c.exec('node models.js')
    // A boolean observation scores 1 or 0: the sandbox's variable is the placeholder.
    const key = await c.exec('printenv GEMINI_API_KEY')
    c.observe('placeholder', /^reeval_secret_/.test(key.stdout))
  },
})
