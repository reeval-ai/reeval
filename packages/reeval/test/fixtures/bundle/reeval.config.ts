import { defineConfig, defineEnvironment } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeJudge } from 'reeval/judge'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({ script: [[{ reply: 'hi' }]] }),
  sandbox: fakeSandbox({ dir: new URL('./sandboxes', import.meta.url) }),
  environments: defineEnvironment('fake', ({ skill, secret }) => ({
    skills: [skill.local('./skills/guide')],
    env: { CHECK_TOKEN: secret.fromEnv('CHECK_TOKEN') },
  })),
  judge: { model: fakeJudge({ score: 0.9 }) },
})
