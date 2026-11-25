import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')

export default defineConfig({
  include: ['*.eval.ts'],
  // A scripted agent that copies ./fake-agent's files into the workspace: multiply alone without
  // the skill, multiply and its test with it, so the compare runs without keys or Docker.
  agents: fakeAgent({
    files: { 'src/math.js': fakeFile('src/math.js') },
    text: 'I added multiply(a, b) to src/math.js.',
    withSkill: {
      files: {
        'src/math.js': fakeFile('src/math.js'),
        'test/math.test.js': fakeFile('test/math.test.js'),
      },
      text: 'I added multiply(a, b) to src/math.js and its test to test/math.test.js.',
    },
  }),
  sandbox: fakeSandbox(),
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
  // profiles go beside them.
  profiles: { ...profiles },
})
