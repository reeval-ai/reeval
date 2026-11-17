import { defineEnvironment, type Turn } from 'reeval'
import { docker } from 'reeval/sandbox'

export const image = defineEnvironment('image', {
  sandbox: docker({ dockerfile: '../docker/Dockerfile', id: 'docker' }),
  egress: 'allow-all',
})

/** reeval's own image, for the canary. */
export const stock = defineEnvironment('stock', {
  sandbox: docker({ id: 'docker' }),
  egress: 'allow-all',
})

export const TOOL = '/opt/reeval-fixture/bin/reeval-fixture-tool'

/** What the scripted agent's shell command printed, one entry per line. */
export const agentSaw = (turn: Turn) =>
  turn.transcript
    .flatMap((e) => (e.type === 'tool' && e.tool === 'shell' ? [e.output] : []))[0]
    ?.split('\n') ?? []
