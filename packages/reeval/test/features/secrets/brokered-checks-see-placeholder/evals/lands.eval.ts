import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { keys } from './env.ts'

// A brokered `to: 'checks'` secret reaches c.exec as a placeholder, not the host value.
export default defineEval({
  environment: keys,
  graders: [
    observed<{ seen: string; hostValue: boolean }>(
      'checks-saw',
      ({ seen, hostValue }) => /^reeval_secret_[0-9A-Za-z]{32}$/.test(seen) && !hostValue,
    ),
  ],
  task: async (c) => {
    const seen = (await c.exec('printf %s "$CHECK_TOKEN"')).stdout
    c.observe('checks-saw', { seen, hostValue: seen === process.env.REEVAL_FIXTURE_TOKEN })
  },
})
