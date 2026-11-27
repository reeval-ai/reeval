import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')

export default defineConfig({
  include: ['*.eval.ts'],
  // A scripted agent that copies ./fake-agent's files into the workspace, so the graders run
  // without keys or Docker.
  agents: fakeAgent({
    files: {
      'src/math.js': fakeFile('src/math.js'),
      'test/math.test.js': fakeFile('test/math.test.js'),
    },
    text: 'I added multiply(a, b) to src/math.js and a test for it.',
  }),
  sandbox: fakeSandbox(),
  trials: 2,
  // `pr` is picked whenever CI is set; `nightly` only with --profile nightly.
  defaultProfile: { ci: 'pr' },
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
  // profiles go beside them.
  profiles: {
    ...profiles,
    pr: { limit: { trials: 1 }, budget: { trials: 10 } },
    nightly: { defaults: { trials: 4 }, record: 'always', budget: { duration: '2h' } },
  },
})
