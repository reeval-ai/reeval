import { isDeepStrictEqual } from 'node:util'
import { defineEnvironment, defineGrader } from 'reeval'
import { execOf } from 'reeval/graders/match'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

export const greeting = defineEnvironment('greeting', ({ skill }) => ({
  sandbox,
  skills: [skill.local('../skills/house-greeting', { placement: 'workspace' })],
}))

/** Lists the skill's files under the skill directory `dir`. */
export const listing = (dir: string) => `cd ${dir}/house-greeting && find . -type f | LC_ALL=C sort`

/** Whether the listing under `dir` is the skill's one file. */
export const skillFiles = (dir: string) =>
  defineGrader('skill-files', {
    grade: (c) => (execOf(c, listing(dir))?.stdout ?? '').trim().split('\n'),
    score: (files) => (isDeepStrictEqual(files, ['./SKILL.md']) ? 1 : 0),
  })
