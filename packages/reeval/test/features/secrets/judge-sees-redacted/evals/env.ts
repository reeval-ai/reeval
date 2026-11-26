import { writeFileSync } from 'node:fs'
import { type AttemptContext, defineEnvironment } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

// REEVAL_FIXTURE_AGENT_VALUE's name isn't secret-looking: only its secret() declaration masks it.
export const tokens = defineEnvironment('tokens', ({ secret }) => ({
  sandbox,
  env: {
    CHECK_TOKEN: secret.fromEnv('REEVAL_FIXTURE_TOKEN', { to: 'checks' }),
    AGENT_TOKEN: secret.fromEnv('REEVAL_FIXTURE_AGENT_VALUE'),
  },
}))

/** The agent prints its secret and a check prints the checks' one. */
export async function printTokens(c: AttemptContext) {
  await c.send('print AGENT_TOKEN')
  await c.exec('printf %s "$CHECK_TOKEN"')
}

type Seen = { checks?: Array<{ stdout: string }>; trajectory?: string }

/**
 * A judge grader shown the checks and the trajectory, which scores 1 when `ok` holds of what it
 * was sent, also written to `judge-saw-<name>.json` for the host to compare with
 * `judge-input.json`.
 */
export const sawRedacted = (name: string, ok: (state: Seen) => boolean) =>
  judge('Did the agent print its token?', {
    name: 'sees-redacted',
    inputs: { checks: true, trajectory: 'full' },
    model: fakeJudge({
      score: (s) => {
        writeFileSync(new URL(`../judge-saw-${name}.json`, import.meta.url), JSON.stringify(s))
        return ok(s as Seen) ? 1 : 0
      },
    }),
  })
