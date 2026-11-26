import { defineEnvironment, defineGrader } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

const host = process.env.REEVAL_EGRESS_HOST ?? 'missing.invalid'

export const keyed = defineEnvironment('keyed', ({ secret }) => ({
  sandbox,
  egress: 'deny-all',
  env: { TOKEN: secret.fromEnv('REEVAL_FIXTURE_TOKEN', { hosts: [host] }) },
}))
export const closed = defineEnvironment('closed', { sandbox, egress: 'deny-all' })

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
