import { defineEnvironment, defineGrader } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

// deny-all: the search goes to generativelanguage.googleapis.com, the harness's automatic host.
export const closed = defineEnvironment('closed', { sandbox, egress: 'deny-all' })

export const prompt =
  'Use your web search tool (not the shell, not curl) once, to search for "google antigravity ' +
  'cli". Then reply with one URL it found and nothing else.'

export const completed = defineGrader('completed', {
  grade: (c) => c.turns[0]?.status === 'completed',
})

/** A search succeeded: one the gateway refused is still a web-search event, with ok false. */
export const succeededSearch = defineGrader('search-succeeded', {
  grade: (c) =>
    (c.turns[0]?.transcript ?? []).some((e) => e.type === 'web-search' && e.ok !== false),
})
