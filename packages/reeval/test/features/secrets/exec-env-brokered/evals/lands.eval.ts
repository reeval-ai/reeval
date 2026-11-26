import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { keys } from './env.ts'

// The host value of a brokered secret, inside a longer value, reaches the command as the
// environment's placeholder for it.
export default defineEval({
  environment: keys,
  graders: [
    observed<{ seen: string; placeholder: string }>(
      'auth',
      ({ seen, placeholder }) => seen === `Bearer ${placeholder}`,
    ),
  ],
  task: async (c) => {
    const env = { AUTH: `Bearer ${process.env.REEVAL_FIXTURE_TOKEN}` }
    const seen = (await c.exec('printf %s "$AUTH"', { env })).stdout
    const placeholder = (await c.exec('printf %s "$CHECK_TOKEN"')).stdout
    c.observe('auth', { seen, placeholder })
  },
})
