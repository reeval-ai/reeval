import { defineEnvironment, defineGrader } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

export const tokens = defineEnvironment('tokens', ({ secret }) => ({
  sandbox,
  env: { CHECK_TOKEN: secret.fromEnv('REEVAL_FIXTURE_TOKEN', { to: 'checks' }) },
}))

const token = () => process.env.REEVAL_FIXTURE_TOKEN

export const value = defineGrader('value', { grade: () => `token ${token()}`, score: () => 1 })
export const fromExec = defineGrader('from-exec', {
  grade: (c) => c.execs[0]?.stdout ?? '',
  score: () => 1,
})
export const thrower = (weight: number) =>
  defineGrader('thrower', {
    weight,
    grade: () => {
      throw new Error(`bad ${token()}`)
    },
  })
