import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')

export default defineConfig({
  include: ['*.eval.ts'],
  // A scripted agent that writes ./fake-agent's files into the workspace and then runs the tests,
  // as the rules say, so the checks run without keys or Docker.
  agents: fakeAgent({
    script: [
      [
        {
          write: {
            'src/math.js': fakeFile('src/math.js'),
            'test/math.test.js': fakeFile('test/math.test.js'),
          },
        },
        { exec: 'npm test' },
      ],
    ],
    text: 'I added multiply(a, b) to src/math.js with a test, and npm test passes.',
  }),
  sandbox: fakeSandbox(),
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
  // profiles go beside them.
  profiles: { ...profiles },
})
