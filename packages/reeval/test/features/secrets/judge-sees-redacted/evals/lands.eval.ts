import { defineEval } from 'reeval'
import { printTokens, sawRedacted, tokens } from './env.ts'

const raw = () => [process.env.REEVAL_FIXTURE_TOKEN, process.env.REEVAL_FIXTURE_AGENT_VALUE]

// The judge is sent [REDACTED] for a `to: 'checks'` secret in a check's output and for an
// unbrokered secret the agent printed.
export default defineEval({
  environment: tokens,
  graders: [
    sawRedacted(
      'lands',
      (s) =>
        s.checks?.[0]?.stdout === '[REDACTED]' &&
        /AGENT_TOKEN[\s\S]*\[REDACTED\]/.test(s.trajectory ?? '') &&
        !raw().some((value) => value && JSON.stringify(s).includes(value)),
    ),
  ],
  task: printTokens,
})
