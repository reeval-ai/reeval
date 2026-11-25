import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')
const turn = (n: number) => ({
  write: {
    'src/math.js': fakeFile(`turn-${n}/src/math.js`),
    'test/math.test.js': fakeFile(`turn-${n}/test/math.test.js`),
  },
})

export default defineConfig({
  include: ['*.eval.ts'],
  // A scripted agent that writes ./fake-agent/turn-1 on the first turn and turn-2 on the
  // second, so the checks run without keys or Docker.
  agents: fakeAgent({
    script: [
      [turn(1), { reply: 'I added multiply(a, b) to src/math.js and a test for it.' }],
      [turn(2), { reply: 'multiply now takes any number of arguments, with a test.' }],
    ],
  }),
  sandbox: fakeSandbox(),
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
  // profiles go beside them.
  profiles: { ...profiles },
})
