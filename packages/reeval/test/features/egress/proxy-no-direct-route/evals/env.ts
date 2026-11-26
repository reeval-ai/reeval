import { defineEnvironment, defineGrader } from 'reeval'
import { docker, fakeSandbox, podman } from 'reeval/sandbox'

/** The Docker and Podman tiers run the same containers. */
const container = process.env.REEVAL_FIXTURE_SANDBOX === 'podman' ? podman : docker

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker' || process.env.REEVAL_FIXTURE_SANDBOX === 'podman'
    ? container()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

/** No egress set: the default, 'proxy'. */
export const proxied = defineEnvironment('proxied', { sandbox })
export const open = defineEnvironment('open', { sandbox, egress: 'allow-all' })

/** What the scripted agent's shell commands printed, passing when `check` holds. */
export const agentPrinted = (name: string, check: (outputs: string[]) => boolean) =>
  defineGrader(name, {
    grade: (c) =>
      c.turns.flatMap((t) =>
        t.trajectory.flatMap((e) =>
          e.type === 'tool' && e.tool === 'shell' ? [String(e.output ?? '')] : [],
        ),
      ),
    score: (outputs) => (check(outputs) ? 1 : 0),
  })
