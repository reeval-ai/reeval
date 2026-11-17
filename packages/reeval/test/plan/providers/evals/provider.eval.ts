import { defineEnvironment, evaluate } from 'reeval'
import { claudeCode, cursor } from 'reeval/harness'
import { docker } from 'reeval/sandbox'

const toolchain = defineEnvironment('toolchain', {
  sandbox: docker({ from: 'python:3.12-slim', install: ['pip install pytest'] }),
  egress: 'allow-all',
})
const prebuilt = defineEnvironment('prebuilt', {
  sandbox: docker({ id: 'agent', image: 'ghcr.io/acme/agent:1' }),
  egress: 'allow-all',
})

evaluate('the default sandbox', { egress: 'allow-all' }, async () => {})
evaluate('a toolchain image', { environments: toolchain }, async () => {})
evaluate('a prebuilt image', { environments: prebuilt }, async () => {})
evaluate(
  'real harnesses',
  {
    egress: 'allow-all',
    harnesses: [cursor({ model: 'composer-2.5' }), claudeCode({ model: 'claude-sonnet-5' })],
  },
  async () => {},
)
