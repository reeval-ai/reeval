import { defineEnvironment, defineEval } from 'reeval'
import { cursor, fakeAgent } from 'reeval/agent'
import { cloud } from 'reeval/internal/vm'

const small = defineEnvironment('small', { sandbox: cloud(), egress: 'allow-all' })
const medium = defineEnvironment('medium', {
  sandbox: cloud({ size: 'medium' }),
  egress: 'allow-all',
})
const shared = defineEnvironment('shared', {
  sandbox: cloud({ size: 'large', reuse: true, trialsPerMachine: 2, maxConcurrent: 4 }),
  egress: 'allow-all',
})
const python = defineEnvironment('python', {
  sandbox: cloud({ from: 'python:3.12', install: [{ run: 'pip install pytest' }] }),
})

export default defineEval({
  environment: shared,
  agents: fakeAgent(),
  trials: 2,
  task: async () => {},
})
