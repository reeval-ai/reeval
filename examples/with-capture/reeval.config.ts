import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeJudge } from 'reeval/judge'
import { docker, fakeSandbox } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')

export default defineConfig({
  include: ['*.eval.ts'],
  // A scripted agent that copies ./fake-agent's files into the workspace, so the graders run
  // without keys or Docker. The fake sandbox saves a 1×1 placeholder for each screenshot.
  agents: fakeAgent({
    files: { 'index.html': fakeFile('index.html') },
    text: 'I added a Sign up button under the intro paragraph.',
  }),
  sandbox: fakeSandbox(),
  judge: { model: fakeJudge({ score: 0.9 }) },
  profiles: {
    // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
    // profiles go beside them.
    ...profiles,
    // The fake agent in Docker, where Chrome takes the real screenshot; no keys.
    docker: { defaults: { sandbox: docker() } },
  },
})
