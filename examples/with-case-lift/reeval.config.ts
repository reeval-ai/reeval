import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')

export default defineConfig({
  include: ['*.eval.ts'],
  // A scripted agent that copies ./fake-agent's files into the workspace: every case's function,
  // with JSDoc blocks only when it has the skill, so the family shows a lift without keys or
  // Docker.
  agents: fakeAgent({
    files: { 'src/math.js': fakeFile('without-skill/src/math.js') },
    text: 'I added the function to src/math.js.',
    withSkill: {
      files: { 'src/math.js': fakeFile('with-skill/src/math.js') },
      text: 'I added the function to src/math.js, with a JSDoc block.',
    },
  }),
  sandbox: fakeSandbox(),
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
  // profiles go beside them.
  profiles: { ...profiles },
})
