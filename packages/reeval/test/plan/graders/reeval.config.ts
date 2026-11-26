import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { noPageErrors, turns } from 'reeval/graders'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent(),
  sandbox: fakeSandbox(),
  graders: [turns(), noPageErrors('home', { weight: 0.5 })],
  profiles: {
    ci: {
      defaults: {
        graders: [{ builtin: 'within-limits', args: [{ tokens: 200000 }], required: true }],
      },
    },
  },
})
