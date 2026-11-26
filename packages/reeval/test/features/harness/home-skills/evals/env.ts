import { defineEnvironment, defineGrader, type Turn } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

export const greeting = defineEnvironment('greeting', ({ skill }) => ({
  sandbox,
  skills: [skill.local('../skills/house-greeting')],
}))

/** What the scripted agent's `n`th shell command printed. */
export const shellOutput = (turn: Pick<Turn, 'trajectory'> | undefined, n: number) =>
  (turn?.trajectory ?? []).flatMap((e) =>
    e.type === 'tool' && e.tool === 'shell' ? [String(e.output ?? '')] : [],
  )[n]

/** Whether the agent's `n`th shell command printed the skill. */
export const readsSkill = (n: number) =>
  defineGrader(`reads-the-skill-${n}`, {
    grade: (c) => shellOutput(c.turns[0], n) ?? null,
    score: (out) => (out?.includes('Greet people with "Ahoy, <name>!".') ? 1 : 0),
  })
