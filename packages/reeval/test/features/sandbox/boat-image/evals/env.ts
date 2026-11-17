import { defineEnvironment, type Turn } from 'reeval'
import { docker } from 'reeval/sandbox'

const sandbox = docker({ install: ['echo baked-by-boat-image > /etc/reeval-recipe'] })

export const closed = defineEnvironment('closed', { sandbox, egress: 'deny-all' })
export const open = defineEnvironment('open', { sandbox, egress: 'allow-all' })

/** What the scripted agent's shell command printed, one entry per line. */
export const agentSaw = (turn: Turn) =>
  turn.transcript
    .flatMap((e) => (e.type === 'tool' && e.tool === 'shell' ? [e.output] : []))[0]
    ?.split('\n') ?? []
