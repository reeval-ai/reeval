import type { SubagentSupport } from '../catalog/entry.ts'
import type { SubagentRun, SubagentUsage, TokenUsage, TrajectoryEvent } from '../types.ts'
import { addUsage, sumUsage } from '../usage.ts'
import { harnessUsage } from './agent.ts'

/**
 * The subagents a turn spawned, each with the usage its CLI stored for it when `support` has a
 * reader and its spawn named it. `read` runs a command in the sandbox and gives its output, or
 * undefined when it failed.
 */
export async function turnSubagents(
  support: SubagentSupport | undefined,
  trajectory: readonly TrajectoryEvent[],
  raw: readonly unknown[],
  read: (command: string) => Promise<string | undefined>,
): Promise<SubagentRun[]> {
  if (!support) return []
  const spawned = support.spawns(trajectory, raw)
  if (!spawned.length) return []
  const parents = new Map(
    trajectory.flatMap((e) =>
      'toolCallId' in e && 'subagent' in e && e.subagent ? [[e.toolCallId, e.subagent]] : [],
    ),
  )
  const ids = spawned.flatMap((s) => (s.nativeId ? [s.nativeId] : []))
  const store = ids.length ? await support.stored?.() : undefined
  const printed = store ? await read(store.command(ids)) : undefined
  const stored = store && printed !== undefined ? store.parse(printed) : {}
  return spawned.map((s) => {
    const found = s.nativeId ? stored[s.nativeId] : undefined
    const parent = parents.get(s.id)
    const model = s.model ?? found?.model
    const ran =
      found?.startedAt !== undefined && found.endedAt !== undefined
        ? found.endedAt - found.startedAt
        : null
    return {
      ...s,
      ...(parent ? { parent } : {}),
      ...(model ? { model } : {}),
      durationMs: s.durationMs ?? ran,
      events: support.events,
      usage: found ? harnessUsage(found.usage) : null,
    }
  })
}

/**
 * A turn's usage with its subagents': on a `separate` harness the agent's own `reported` usage
 * plus each subagent's, on an `included` one `reported` as it is, with the agent's own share
 * when every subagent's is known. A subagent that may not have finished when the turn ended, or
 * on a `separate` harness one whose usage is unknown, makes the total `missing`. `fromStore`
 * marks usage read back from the CLI's store for a turn whose stream reported none, which may
 * count subagents already. With no usage for the agent's own calls, a `separate` harness's total
 * is its subagents' alone, a lower bound.
 */
export function turnTotals(
  mode: SubagentSupport['usage'],
  reported: TokenUsage | null,
  runs: readonly SubagentRun[],
  fromStore: boolean,
): { usage: TokenUsage | null; agentUsage: TokenUsage | null; subagentUsage: SubagentUsage } {
  const known = runs.every((r) => r.usage !== null && r.status !== null)
  const children = sumUsage(runs.map((r) => r.usage))
  if (mode === 'unknown' || (fromStore && reported !== null)) {
    return { usage: reported, agentUsage: null, subagentUsage: 'unknown' }
  }
  if (reported === null) {
    return mode === 'separate' && children
      ? { usage: children, agentUsage: null, subagentUsage: 'missing' }
      : { usage: null, agentUsage: null, subagentUsage: 'unknown' }
  }
  if (mode === 'separate') {
    return {
      usage: addUsage(reported, children),
      agentUsage: reported,
      subagentUsage: known ? 'counted' : 'missing',
    }
  }
  return {
    usage: reported,
    agentUsage: known && children ? subtract(reported, children) : null,
    subagentUsage: runs.every((r) => r.status !== null) ? 'counted' : 'missing',
  }
}

function subtract(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: Math.max(a.input - b.input, 0),
    output: Math.max(a.output - b.output, 0),
    cacheRead: Math.max(a.cacheRead - b.cacheRead, 0),
    cacheWrite: Math.max(a.cacheWrite - b.cacheWrite, 0),
    reasoning:
      a.reasoning === null || b.reasoning === null ? null : Math.max(a.reasoning - b.reasoning, 0),
  }
}
