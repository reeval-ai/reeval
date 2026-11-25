import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { docker } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')

export default defineConfig({
  include: ['*.eval.ts'],
  // A scripted agent that copies ./fake-agent's files into the workspace.
  agents: fakeAgent({
    files: { 'models.js': fakeFile('models.js') },
    text: 'I wrote models.js, which lists the Gemini models.',
  }),
  // Only Docker's egress gateway swaps the placeholder for the key; fakeSandbox() doesn't.
  sandbox: docker(),
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
  // profiles go beside them.
  profiles: { ...profiles },
})
