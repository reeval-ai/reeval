import { defineEval } from 'reeval'
import { printTokens, sawRedacted, tokens } from './env.ts'

// Must fail: the judge isn't sent the check's real output.
export default defineEval({
  environment: tokens,
  graders: [
    sawRedacted('canary', (s) => s.checks?.[0]?.stdout === process.env.REEVAL_FIXTURE_TOKEN),
  ],
  task: printTokens,
})
