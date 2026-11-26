import { defineEnvironment, defineGrader } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

/**
 * Policies the fake sandbox accepts too: it enforces neither, but the switch still comes between
 * the setup steps and the agent.
 */
export const phased = defineEnvironment('phased', {
  sandbox,
  egress: { setup: 'allow-all', agent: 'proxy' },
  setup: [{ run: 'echo ready > ready.txt' }],
})

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
