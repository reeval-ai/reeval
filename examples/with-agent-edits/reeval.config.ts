import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')
const files = { 'src/math.js': fakeFile('src/math.js') }

export default defineConfig({
  include: ['*.eval.ts'],
  // Two scripted agents that copy ./fake-agent's files into the workspace, so each eval has a
  // list of agents to edit, without keys or Docker.
  agents: [
    fakeAgent({ id: 'fake-quick', files }),
    fakeAgent({ id: 'fake-careful', script: [[{ exec: 'node --test' }]], files }),
  ],
  sandbox: fakeSandbox(),
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
  // profiles go beside them.
  profiles: { ...profiles },
})
