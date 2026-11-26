import { defineEnvironment, defineGrader } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

// deny-all: the provider's API is one of the automatic hosts, so the turn still runs.
export const closed = defineEnvironment('closed', { sandbox, egress: 'deny-all' })

export const prompt =
  'Run `printenv ANTHROPIC_API_KEY GOOGLE_GENERATIVE_AI_API_KEY OPENAI_API_KEY > keys.txt; ' +
  'true` once with your shell tool, then reply "done".'

/** The keys the agent's shell saw, one per line: printenv prints only the set ones. */
const keysSeen = (text: string | null) => (text ?? '').split('\n').filter(Boolean)

const keys = (name: string, score: (keys: string[]) => boolean) =>
  defineGrader(name, {
    files: ['keys.txt'],
    grade: async (c) => keysSeen(await c.readFile('keys.txt')),
    score: (seen) => (score(seen) ? 1 : 0),
  })

export const onePlaceholder = keys(
  'one-placeholder',
  (seen) => seen.length === 1 && /^aisdkhc_[\w-]{43}$/.test(seen[0] ?? ''),
)
export const twoKeys = keys('two-keys', (seen) => seen.length === 2)
