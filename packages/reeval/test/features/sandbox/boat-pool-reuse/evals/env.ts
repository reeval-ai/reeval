import { defineEnvironment, type Turn } from 'reeval'
import { docker } from 'reeval/sandbox'

export const vm = defineEnvironment('vm', {
  sandbox: docker(),
  egress: 'allow-all',
})

/** What the scripted agent's shell command printed, one entry per line. */
export const agentSaw = (turn: Turn) =>
  turn.trajectory
    .flatMap((e) => (e.type === 'tool' && e.tool === 'shell' ? [e.output] : []))[0]
    ?.split('\n') ?? []
