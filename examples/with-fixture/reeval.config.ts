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
      'src/csv.js': fakeFile('src/csv.js'),
      'test/csv.test.js': fakeFile('test/csv.test.js'),
    },
    text: 'I added stringifyCsv(rows) to src/csv.js, with a round-trip test on data/people.csv.',
  }),
  sandbox: fakeSandbox(),
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
  // profiles go beside them.
  profiles: { ...profiles },
})
