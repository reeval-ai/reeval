import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  include: ['evals/**/*.eval.py'],
  agents: fakeAgent({}),
  sandbox: fakeSandbox(),
})
