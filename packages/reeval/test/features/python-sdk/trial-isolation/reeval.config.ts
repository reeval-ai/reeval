import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { docker, fakeSandbox } from 'reeval/sandbox'

// REEVAL_FIXTURE_SANDBOX picks fake (F) or docker (D).
const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('./sandboxes', import.meta.url) })

export default defineConfig({
  target: regression(),
  include: ['evals/**/*.eval.py'],
  agents: fakeAgent({ script: [[{ reply: 'Nothing to do.' }]] }),
  sandbox,
})
