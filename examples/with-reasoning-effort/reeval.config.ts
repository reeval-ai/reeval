import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { claudeCode, fakeAgent } from 'reeval/agent'
import { docker, fakeSandbox } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')
const files = {
  'src/math.js': fakeFile('src/math.js'),
  'test/math.test.js': fakeFile('test/math.test.js'),
}

export default defineConfig({
  include: ['*.eval.ts'],
  // One scripted agent at two reasoning efforts, each its own cell. It copies ./fake-agent's
  // files into the workspace, so the checks run without keys or Docker.
  agents: [
    fakeAgent({ effort: 'low', servedModel: 'fake-1[effort=low]', files }),
    fakeAgent({ effort: 'high', servedModel: 'fake-1[effort=high]', files }),
  ],
  sandbox: fakeSandbox(),
  profiles: {
    // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
    // profiles go beside them.
    ...profiles,
    // Claude Code at two efforts: ANTHROPIC_API_KEY.
    'claude-code-efforts': {
      defaults: {
        agents: [
          claudeCode({ model: 'claude-sonnet-5', effort: 'low' }),
          claudeCode({ model: 'claude-sonnet-5', effort: 'high' }),
        ],
        sandbox: docker(),
      },
    },
  },
})
