import { defineEnvironment, defineGrader } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

export const brokered = defineEnvironment('brokered', { sandbox })

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
