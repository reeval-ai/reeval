import { defineEnvironment, defineGrader } from 'reeval'
import { docker, fakeSandbox, podman } from 'reeval/sandbox'

/** The Docker and Podman tiers run the same containers. */
const container = process.env.REEVAL_FIXTURE_SANDBOX === 'podman' ? podman : docker

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker' || process.env.REEVAL_FIXTURE_SANDBOX === 'podman'
    ? container()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

export const listed = defineEnvironment('listed', {
  sandbox,
  egress: { allow: ['api.example.com'] },
})

/** What the scripted agent's shell commands printed, passing when `check` holds. */
export const agentPrinted = (name: string, check: (outputs: string[]) => boolean) =>
  defineGrader(name, {
    grade: (c) =>
      c.turns.flatMap((t) =>
        t.transcript.flatMap((e) =>
          e.type === 'tool' && e.tool === 'shell' ? [String(e.output ?? '')] : [],
        ),
      ),
    score: (outputs) => (check(outputs) ? 1 : 0),
  })
