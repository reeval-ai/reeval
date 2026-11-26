import { defineEnvironment, defineGrader } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

// deny-all: the search host is one the adapter's automatic hosts let through.
export const closed = defineEnvironment('closed', { sandbox, egress: 'deny-all' })

export const prompt =
  'Use your websearch tool (not the shell, not curl) once, to search for "anomalyco opencode ' +
  'github". Then reply with the first result\'s URL and nothing else.'

export const completed = defineGrader('completed', {
  grade: (c) => c.turns[0]?.status === 'completed',
})

/** The turn's web searches came back with pages: each web-search event's references. */
export const found = defineGrader('found-pages', {
  grade: (c) =>
    Math.max(
      0,
      ...(c.turns[0]?.transcript ?? []).flatMap((e) =>
        e.type === 'web-search' ? [e.references ?? 0] : [],
      ),
    ),
  score: (pages) => (pages > 0 ? 1 : 0),
})
