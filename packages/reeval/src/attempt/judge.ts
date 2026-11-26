import { getRunContext } from '../engine/runtime.ts'
import { gatewayScope, resolveModelGateway } from '../gateway/models.ts'
import type { DraftSource } from '../judge/draft.ts'
import { judgeModelName } from '../judge/index.ts'
import { withLease } from '../scheduler/client.ts'
import type { JudgeModel, JudgeOptions, Turn } from '../types.ts'
import type { Attempt } from './state.ts'

/**
 * The attempt's turns as the judge's state draws them, and the graded one's index; a subject the
 * attempt didn't send is drafted alone.
 */
export function judgeTurns(a: Attempt, subject: Turn): { turns: DraftSource[]; subject: number } {
  // By name: spreading a turn reads its `status` getter, which marks the turn's error as read.
  const byName = (turn: Turn, i: number): DraftSource => ({
    prompt: turn.prompt,
    text: turn.text,
    trajectory: turn.trajectory,
    subagents: a.record.turns[i]?.subagents,
  })
  const at = a.turns.indexOf(subject)
  return at >= 0
    ? { turns: a.turns.map(byName), subject: at }
    : { turns: [byName(subject, -1)], subject: 0 }
}

/**
 * Runs `judge` with `options` routed through the gateway the run's list picks for its model, under
 * the model's provider's concurrency lease, as the attempt's judge time.
 */
export function onJudge<T>(
  a: Attempt,
  options: JudgeOptions & { model: JudgeModel },
  judge: (routed: Omit<JudgeOptions, 'maxConcurrent'> & { model: JudgeModel }) => Promise<T>,
): Promise<T> {
  return a.timed('judgeMs', () => routedJudge(options, judge, a.signal))
}

/**
 * A judge call through the run's gateway for its model, under the judge provider's concurrency
 * lease.
 */
export function routedJudge<T>(
  options: JudgeOptions & { model: JudgeModel },
  judge: (routed: Omit<JudgeOptions, 'maxConcurrent'> & { model: JudgeModel }) => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  const { maxConcurrent, ...judgeOptions } = options
  const { config, profile } = getRunContext()
  const scope = gatewayScope(config, profile)
  const gateway = resolveModelGateway(options.model, judgeOptions.gateway, scope, 'judge model')
  const { gateway: _pin, ...unpinned } = judgeOptions
  // The list's entry, so the judge gets its settings (OpenRouter's fallbacks,
  // Vertex's project and regions).
  const entry = gateway && scope.gateways.find((g) => g.kind === gateway)
  const routed = gateway ? { ...unpinned, gateway: entry || gateway } : unpinned
  const provider = judgeModelName(options.model).split('/')[0]
  return withLease(
    maxConcurrent ? { [`judge:${provider}`]: maxConcurrent } : {},
    () => judge(routed),
    signal,
  )
}
