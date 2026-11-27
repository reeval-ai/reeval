import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'
import { local } from 'reeval/store/local'
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
  // Every run is copied into ./history to commit; only failing trials keep their trajectories,
  // diffs and logs, which is history.artifacts' default.
  record: 'always',
  history: { store: local({ dir: 'history' }), artifacts: 'failures' },
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
  // profiles go beside them.
  profiles: { ...profiles },
})
