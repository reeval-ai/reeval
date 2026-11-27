// The trial protocol's contract (src/contract/trial.ts): real turns from the record corpus fit
// it as replies, under both its Zod schemas and the JSON Schema in schema/protocol/, and its
// shared defs stay held to their hand-written types.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { corpus } from '../scripts/schema/corpus.ts'
import type { ShapeSchema } from '../scripts/schema/generate.ts'
import { typeDrift } from '../scripts/schema/protocol.ts'
import { validate } from '../scripts/schema/validate.ts'
import { zodDefs } from '../scripts/schema/zod.ts'
import {
  TRIAL_SCHEMAS,
  trajectoryEventSchema,
  trialAbortSchema,
  trialDoneSchema,
  trialReplySchema,
  trialRequestSchema,
  trialStartSchema,
} from '../src/contract/trial.ts'
import type { TrajectoryEvent, TurnData } from '../src/types.ts'
import { MIGRATIONS, readableTrajectoryLine } from '../src/view/record.ts'

const snapshot = (name: string): ShapeSchema =>
  JSON.parse(
    readFileSync(new URL(`../schema/protocol/${name}.schema.json`, import.meta.url), 'utf8'),
  )

type Line = { turn: number; type: string; [key: string]: unknown }

/** Each trajectory in the corpus as the turns a `send` reply would carry. */
function corpusTurns(): TurnData[] {
  return corpus().trajectories.flatMap((file) => {
    const turns = new Map<number, TurnData>()
    for (const text of readFileSync(file, 'utf8').split('\n')) {
      if (!text.trim()) continue
      const { turn, ...line } = readableTrajectoryLine(JSON.parse(text)) as unknown as Line
      if (line.type === 'prompt') {
        turns.set(turn, {
          prompt: line.text as string,
          text: '',
          status: 'completed',
          startedAt: line.ts as string,
          durationMs: 0,
          trajectory: [],
          usage: null,
          model: null,
          unreported: [],
          diff: { patch: '', files: [] },
        })
      } else if (line.type === 'turn-end') {
        const t = turns.get(turn) as TurnData
        Object.assign(t, { status: line.status, durationMs: line.durationMs })
      } else if (line.type !== 'decision') {
        ;(turns.get(turn) as TurnData).trajectory.push(line as unknown as TrajectoryEvent)
      }
    }
    return [...turns.values()]
  })
}

test('every turn in the record corpus fits a send reply, in Zod and in the JSON Schema', () => {
  const turns = corpusTurns()
  assert.ok(turns.length >= 100, `${turns.length} turns`)
  const kinds = new Set(turns.flatMap((t) => t.trajectory.map((e) => e.type)))
  assert.deepEqual([...kinds].sort(), ['file-edit', 'model-call', 'reasoning', 'text', 'tool'])
  const reply = snapshot('trial-reply')
  for (const [i, turn] of turns.entries()) {
    const value = { id: String(i), ok: true, op: 'send', turn }
    const parsed = trialReplySchema.safeParse(value)
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues[0]))
    assert.deepEqual(validate(reply, value), [])
  }
  // The canary: an event with a field the trajectory doesn't have.
  const [first] = turns
  const event = { ...(first?.trajectory[0] as TrajectoryEvent), color: 'blue' }
  assert.equal(trajectoryEventSchema.safeParse(event).success, false)
})

test('every trial in the record corpus has a start message, in Zod and in the JSON Schema', () => {
  type Cell = { key: string; harness: string; environment: string; sandbox: string; role: string }
  type Eval = {
    file: string
    name: string
    cells?: Array<Cell & { variant?: string }>
    trials?: Array<{ id: string; cell: string; n: number }>
  }
  const current = (record: Record<string, unknown>) => {
    let r = structuredClone(record)
    for (const [from, migrate] of Object.entries(MIGRATIONS['run-record'] ?? {})) {
      if (r.schemaVersion === Number(from)) r = (migrate as (v: unknown) => typeof r)(r)
    }
    return r
  }
  const starts = corpus().records.flatMap(({ value }) =>
    ((current(value).evals ?? []) as Eval[]).flatMap((e) =>
      (e.trials ?? []).map((a) => {
        const found = e.cells?.find((c) => c.key === a.cell)
        assert.ok(found, `${e.name}: trial ${a.id}'s cell ${a.cell}`)
        const { key, harness, environment, sandbox, role, variant } = found
        const cell = { key, harness, environment, sandbox, role, ...(variant ? { variant } : {}) }
        return { type: 'start', trial: { id: a.id, cell, n: a.n }, file: e.file, body: e.name }
      }),
    ),
  )
  assert.ok(starts.length >= 50, `${starts.length} trials`)
  assert.ok(starts.some((s) => s.trial.cell.role === 'variant'))
  const schema = snapshot('trial-start')
  for (const start of starts) {
    const parsed = trialStartSchema.safeParse(start)
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues[0]))
    assert.deepEqual(validate(schema, start), [])
  }
  // The canary: a run number as a string.
  const [first] = starts
  const text = { ...first, trial: { ...first?.trial, n: '1' } }
  assert.equal(trialStartSchema.safeParse(text).success, false)
  assert.notDeepEqual(validate(schema, text), [])
})

test('abort and done round-trip through JSON unchanged', () => {
  const abort = { type: 'abort', reason: 'timeout', message: 'Eval timed out after 600s' }
  const done = { type: 'done', error: { name: 'AssertionError', message: 'expected 1 to be 2' } }
  for (const [schema, value, name] of [
    [trialAbortSchema, abort, 'trial-abort'],
    [trialDoneSchema, done, 'trial-done'],
    [trialDoneSchema, { type: 'done' }, 'trial-done'],
  ] as const) {
    const through = JSON.parse(JSON.stringify(value))
    assert.deepEqual(schema.parse(through), value)
    assert.deepEqual(validate(snapshot(name), through), [])
  }
})

test('a call and its reply round-trip through JSON unchanged', () => {
  const request = {
    id: '7',
    call: { op: 'exec', command: 'npm test', label: 'tests pass', retries: 2, interval: 500 },
  }
  const reply = {
    id: '7',
    ok: true,
    op: 'exec',
    result: { exitCode: 0, stdout: 'ok', stderr: '' },
  }
  const failed = {
    id: '8',
    ok: false,
    op: 'exec',
    error: { name: 'UsageError', message: 'No sandbox yet', stack: 'at …' },
  }
  for (const [schema, value, name] of [
    [trialRequestSchema, request, 'trial-request'],
    [trialReplySchema, reply, 'trial-reply'],
    [trialReplySchema, failed, 'trial-reply'],
  ] as const) {
    const through = JSON.parse(JSON.stringify(value))
    assert.deepEqual(schema.parse(through), value)
    assert.deepEqual(validate(snapshot(name), through), [])
  }
})

test('a served app, captured and killed, round-trips through JSON unchanged', () => {
  const capture = {
    name: 'about',
    port: 3000,
    path: '/about',
    viewport: 'full-page',
    file: { path: 'artifacts/about.png', sha256: 'ab12', bytes: 2048 },
    status: 200,
    finalUrl: '/about',
    console: [{ level: 'warning', text: 'slow', source: 'console-api', url: '/about' }],
    errors: [],
    failedRequests: [{ method: 'GET', url: '/missing.js', status: 404 }],
  }
  const steps = [
    [
      { op: 'serve', command: 'npm start', port: 3000 },
      { op: 'serve', handle: 'h1', port: 3000 },
    ],
    [
      { op: 'exec', command: 'npm run watch', background: true },
      { op: 'exec', result: { handle: 'h2' } },
    ],
    [
      { op: 'capture', target: { handle: 'h1' }, options: { path: '/about', wait: 'idle' } },
      { op: 'capture', capture },
    ],
    [{ op: 'kill', handle: 'h2' }, { op: 'kill' }],
    [{ op: 'kill', handle: 'h1' }, { op: 'kill' }],
  ] as const
  for (const [i, [call, result]] of steps.entries()) {
    const request = JSON.parse(JSON.stringify({ id: String(i), call }))
    const reply = JSON.parse(JSON.stringify({ id: String(i), ok: true, ...result }))
    assert.deepEqual(trialRequestSchema.parse(request), request)
    assert.deepEqual(validate(snapshot('trial-request'), request), [])
    assert.deepEqual(trialReplySchema.parse(reply), reply)
    assert.deepEqual(validate(snapshot('trial-reply'), reply), [])
  }
  // The canaries: a background exec's reply that also carries output, and a numeric handle.
  // validate() allows extra keys, so only Zod refuses the first.
  const both = { id: '1', ok: true, op: 'exec', result: { handle: 'h2', exitCode: 0 } }
  assert.equal(trialReplySchema.safeParse(both).success, false)
  const numeric = { id: '1', ok: true, op: 'serve', handle: 1, port: 3000 }
  assert.equal(trialReplySchema.safeParse(numeric).success, false)
  assert.notDeepEqual(validate(snapshot('trial-reply'), numeric), [])
})

test("the protocol's shared defs match their types' properties and TSDoc", () => {
  const defs = zodDefs(TRIAL_SCHEMAS, {})
  assert.deepEqual(typeDrift(defs), [])
  const exec = defs.ExecResult ?? {}
  const drifted = {
    ...defs,
    ExecResult: {
      ...exec,
      properties: { ...exec.properties, signal: { type: 'string' as const } },
    },
  }
  assert.deepEqual(typeDrift(drifted), ['ExecResult: Zod only:   signal?'])
})
