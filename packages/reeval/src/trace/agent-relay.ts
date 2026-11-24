// The agent export's side in the run's main process: each worker's agent spans go on to the
// export, and an attempt whose worker exits before it ends gets its agent span, ended as an error,
// so the turns it already sent have a parent.
import type { AgentSpan } from './agent-spans.ts'

export function agentRelay(send: (span: AgentSpan) => void, canceled: () => boolean = () => false) {
  const open = new Map<string, Map<string, AgentSpan>>()
  return {
    call(owner: string, body: unknown): void {
      if (Array.isArray(body)) {
        for (const span of body as AgentSpan[]) {
          open.get(owner)?.delete(span.spanId)
          send(span)
        }
      } else if (body && typeof body === 'object' && 'open' in body) {
        const span = (body as { open: AgentSpan }).open
        const held = open.get(owner) ?? new Map<string, AgentSpan>()
        open.set(owner, held.set(span.spanId, span))
      }
    },
    released(owner: string, exit?: string): void {
      const held = open.get(owner)
      open.delete(owner)
      if (!exit) return
      // A cancel's attempt is a failure the run caused, as its record says, not an infra error.
      const stopped = canceled()
      for (const span of held?.values() ?? []) {
        send({
          ...span,
          endMs: Math.max(span.startMs, Date.now()),
          attributes: {
            ...span.attributes,
            'reeval.outcome': stopped ? 'fail' : 'infra_error',
            'reeval.error.kind': stopped ? 'aborted' : 'infra',
          },
          status: {
            code: 'error',
            message: stopped
              ? `The run was canceled (the engine worker exited: ${exit})`
              : `The engine worker exited before the attempt ended (${exit})`,
          },
        })
      }
    },
  }
}
