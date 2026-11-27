import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeAnalysis } from 'reeval/judge'
import { fakeSandbox } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')

export default defineConfig({
  include: ['*.eval.ts'],
  // A scripted agent that copies ./fake-agent's files into the workspace: both environments throw for a
  // zero divisor, and only the one with the skill names the argument.
  agents: fakeAgent({
    files: { 'src/math.js': fakeFile('without-skill/src/math.js') },
    text: 'I added divide(a, b) to src/math.js.',
    withSkill: {
      files: { 'src/math.js': fakeFile('with-skill/src/math.js') },
      text: 'I added divide(a, b) to src/math.js; it throws a RangeError when b is 0.',
    },
  }),
  sandbox: fakeSandbox(),
  // The model that answers the questions. This fake votes for the side whose diff names
  // the argument; set a real one, such as 'anthropic/claude-sonnet-5', for real votes.
  analysis: {
    model: fakeAnalysis({ vote: (pair) => (pair.a.diff?.includes('b must') ? 'A' : 'B') }),
  },
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
  // profiles go beside them.
  profiles: { ...profiles },
})
