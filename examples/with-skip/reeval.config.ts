import { readFileSync } from 'node:fs'
import { defineConfig, metric } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')

export default defineConfig({
  include: ['*.eval.ts'],
  // A scripted agent that copies ./fake-agent's files into the workspace, so the checks run
  // without keys or Docker.
  agents: fakeAgent({
    files: { 'src/math.js': fakeFile('src/math.js') },
    text: 'I added the function to src/math.js.',
  }),
  sandbox: fakeSandbox(),
  // Every eval's options: two runs a cell, passing when one of them does (regression() would
  // need both).
  timeout: '5m',
  runs: 2,
  target: metric(0.5),
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
  // profiles go beside them.
  profiles: { ...profiles },
})
