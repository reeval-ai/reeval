import { defineEnvironment, defineGrader } from 'reeval'
import { execOf } from 'reeval/graders/match'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

export const homeFiles = defineEnvironment('home-files', {
  sandbox,
  files: { '~/.config/reeval/hint.txt': 'from home' },
})

/** Whether the stored `command` printed `text`. */
export const prints = (name: string, command: string, text: string) =>
  defineGrader(name, {
    grade: (c) => execOf(c, command)?.stdout ?? null,
    score: (out) => (out === text ? 1 : 0),
  })

export const hint = 'cat ~/.config/reeval/hint.txt'
