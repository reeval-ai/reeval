import { defineEnvironment, defineGrader } from 'reeval'
import { execOf } from 'reeval/graders/match'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

// features.test.ts adds fixture/node_modules/ and fixture/dist/ before the run: gitignored here.
export const fixtureDir = defineEnvironment('fixture-dir', ({ directory }) => ({
  sandbox,
  files: { ...directory('../fixture'), 'README.md': 'overridden' },
}))

export const listing = 'find . -type f | LC_ALL=C sort'

/** Whether the stored `command` printed `text`. */
export const prints = (name: string, command: string, text: string) =>
  defineGrader(name, {
    grade: (c) => execOf(c, command)?.stdout ?? null,
    score: (out) => (out === text ? 1 : 0),
  })
