import { defineEnvironment, defineGrader } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

export const plain = defineEnvironment('plain', { sandbox })

/** One shell call, so the turn is at least two model calls: the call, and the reply after it. */
export const prompt = 'Run `echo ok` once with your shell tool, then reply with what it printed.'

/** Both turns report their tokens: the first its prompt and reply, the second its prompt. */
export const reported = defineGrader('reports-usage', {
  grade: (c) =>
    c.turns.map((t) => ({
      status: t.status,
      input: t.usage?.input ?? null,
      output: t.usage?.output ?? null,
    })),
  score: ([first, again]) =>
    first?.status === 'completed' &&
    (first.input ?? 0) > 0 &&
    (first.output ?? 0) > 0 &&
    (again?.input ?? 0) > 0
      ? 1
      : 0,
})

export const noUsage = defineGrader('no-usage', {
  grade: (c) => c.turns[0]?.usage ?? null,
  score: (usage) => (usage === null ? 1 : 0),
})
