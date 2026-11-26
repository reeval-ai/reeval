import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')

export default defineConfig({
  include: ['*.eval.ts'],
  // A scripted agent that applies ./fake-agent's patch to the checkout with git, so the eval
  // runs without keys.
  agents: fakeAgent({
    script: [
      [
        { write: { 'separators.patch': fakeFile('separators.patch') } },
        { exec: 'git apply separators.patch && rm separators.patch' },
        { exec: 'node --test' },
        { reply: 'camelCase takes a separators option now, with a test and a readme section.' },
      ],
    ],
  }),
  sandbox: fakeSandbox(),
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
  // profiles go beside them.
  profiles: { ...profiles },
})
