// Answers attempt-protocol calls from a language runner on the real AttemptContext.

import type {
  Experimental_DecisionQuestion,
  Experimental_DecisionState,
  Experimental_DecisionStatePart,
} from 'ai'
import { TURN_STATUS } from '../assert.ts'
import {
  type AttemptCall,
  type AttemptReply,
  type AttemptRequest,
  attemptRequestProblem,
  type DecideCallData,
} from '../contract/attempt.ts'
import { UsageError } from '../errors.ts'
import { registerExecEnv } from '../redact.ts'
import type {
  AttemptContext,
  BackgroundHandle,
  DecideCall,
  Turn,
  TurnData,
  TurnStatus,
} from '../types.ts'

/** Wire `TurnData` without reading `turn.status` (that getter marks the body as having inspected it). */
function turnData(turn: Turn): TurnData {
  const status = (turn as Turn & { [TURN_STATUS]?: TurnStatus })[TURN_STATUS]
  if (status === undefined) {
    throw new Error("The turn has no raw status; the language runner can't copy it")
  }
  return {
    prompt: turn.prompt,
    text: turn.text,
    status,
    startedAt: turn.startedAt,
    durationMs: turn.durationMs,
    trajectory: turn.trajectory,
    usage: turn.usage,
    model: turn.model,
    unreported: turn.unreported,
    diff: turn.diff,
  }
}

/** A wire decision state, its `capture` and `inputs` parts made as `c.part` and `c.state` make them. */
async function decideState(
  c: AttemptContext,
  state: DecideCallData['state'],
): Promise<Experimental_DecisionState> {
  if (!Array.isArray(state)) return state as Experimental_DecisionState
  const parts: Experimental_DecisionStatePart[] = []
  for (const part of state) {
    if (part.type === 'capture') parts.push(c.part(part.name))
    else if (part.type === 'inputs') {
      const { type: _type, on, ...inputs } = part
      const turn = on === undefined ? undefined : c.turns[on.turn]
      if (on !== undefined && !turn) {
        throw new UsageError(
          `c.state()'s on is turn ${on.turn}, but the attempt has ${c.turns.length} turns`,
        )
      }
      parts.push(...(await c.state({ ...inputs, ...(turn ? { on: turn } : {}) })))
    } else parts.push(part as Experimental_DecisionStatePart)
  }
  return parts
}

export async function replyToAttempt(
  c: AttemptContext,
  handles: Map<string, BackgroundHandle>,
  request: AttemptRequest,
): Promise<AttemptReply> {
  const { id, call } = request
  registerExecEnv((call as { env?: unknown } | undefined)?.env)
  let problem: string | undefined
  try {
    problem = attemptRequestProblem({ id, call })
  } catch (error) {
    // A value nested deep enough exhausts the stack while it's checked.
    problem = `The attempt request couldn't be checked: ${(error as Error).message}`
  }
  if (problem) {
    const error = { name: 'UsageError', message: problem }
    return { id, ok: false, op: call?.op, error } as AttemptReply
  }
  try {
    const body = await perform(c, handles, call)
    return { id, ok: true, op: call.op, ...body } as AttemptReply
  } catch (error) {
    const { name = 'Error', message = String(error) } = error as Error
    return { id, ok: false, op: call.op, error: { name, message } }
  }
}

async function perform(
  c: AttemptContext,
  handles: Map<string, BackgroundHandle>,
  call: AttemptCall,
): Promise<Record<string, unknown>> {
  switch (call.op) {
    case 'send': {
      const turn = await c.send(call.prompt)
      return { turn: turnData(turn) }
    }
    case 'exec': {
      const env = call.env === undefined ? {} : { env: call.env }
      if (call.background) {
        const handle = await c.exec(call.command, { background: true, ...env })
        const handleId = `h${handles.size + 1}`
        handles.set(handleId, handle)
        return { result: { handle: handleId } }
      }
      const { retries, interval, label } = call
      const result = await c.exec(call.command, {
        ...env,
        ...(label === undefined ? {} : { label }),
        ...(retries === undefined ? {} : { retries }),
        ...(interval === undefined ? {} : { interval }),
      })
      return { result }
    }
    case 'kill':
      await handles.get(call.handle)?.kill()
      return {}
    case 'readFile':
      return { contents: await c.readFile(call.path) }
    case 'writeFile':
      await c.writeFile(
        call.path,
        call.encoding === 'base64' ? Buffer.from(call.contents, 'base64') : call.contents,
      )
      return {}
    case 'observe':
      c.observe(call.name, call.value)
      return {}
    case 'decide': {
      const { op: _op, state, ...rest } = call
      const result = await c.decide({
        ...rest,
        state: await decideState(c, state),
      } as DecideCall<Record<string, Experimental_DecisionQuestion>>)
      const { answers, usage, warnings, providerMetadata, response } = result
      return {
        result: {
          answers,
          usage,
          warnings,
          ...(providerMetadata ? { providerMetadata } : {}),
          response: { modelId: response.modelId, timestamp: response.timestamp.toISOString() },
        },
      }
    }
    default:
      throw new Error(`The language runner called ${call.op}, which this reeval doesn't handle yet`)
  }
}
