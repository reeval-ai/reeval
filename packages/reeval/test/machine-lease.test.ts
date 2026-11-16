// A worker's machine lease (leaseMachine) over the service channel: the wait for a slot holds the
// attempt's timeout, and the hold ends when the lease lands or the wait is canceled.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { backstops, backstopTimer } from '../src/engine/backstop.ts'
import type { MachineDescriptor } from '../src/sandbox/machine.ts'
import { leaseMachine, type WireLease } from '../src/sandbox/machine-service.ts'
import { type CallMessage, useServiceChannel } from '../src/scheduler/services.ts'

const calls: CallMessage[] = []
const reply = useServiceChannel((message) => calls.push(message))

const request = {
  sandbox: { kind: 'boat' } as unknown as MachineDescriptor,
  runId: 'run',
  root: '/project',
  ttlSeconds: 600,
}
const granted: WireLease = {
  info: {},
  machine: 'm1',
  span: 'span',
  slot: 0,
  reused: 0,
  start: null,
  lost: [],
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const answer = (op: string, body: unknown) => {
  const call = calls.find((c) => (c.body as { op: string }).op === op)
  assert.ok(call, `a ${op} call`)
  reply({ t: 'reply', id: call.id, body })
}

test("the wait for a slot doesn't count toward the attempt's timeout", async () => {
  calls.length = 0
  let fired = 0
  const timer = backstopTimer(50, () => fired++)
  const leased = backstops.run(timer, () => leaseMachine(request, new AbortController().signal))
  await sleep(100)
  assert.equal(fired, 0, 'held while the lease is queued')
  answer('lease', granted)
  const lease = await leased
  assert.equal(lease.machine, 'm1')
  await sleep(80)
  assert.equal(fired, 1, 'running again once the lease landed')
  const released = lease.release()
  answer('release', {})
  await released
  timer.clear()
})

test('a canceled wait gives the hold back', async () => {
  calls.length = 0
  let fired = 0
  const timer = backstopTimer(50, () => fired++)
  const abort = new AbortController()
  const leased = backstops.run(timer, () => leaseMachine(request, abort.signal))
  await sleep(10)
  abort.abort(new Error('canceled'))
  await sleep(10)
  answer('abandon', {})
  await assert.rejects(leased, /canceled/)
  await sleep(80)
  assert.equal(fired, 1)
  timer.clear()
})
