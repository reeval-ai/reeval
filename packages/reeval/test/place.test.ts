import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CloudUnsupported, place } from '../src/sandbox/place.ts'
import { slotLimits } from '../src/sandbox/vm-container.ts'
import type { SandboxDescriptor } from '../src/types.ts'

const WHERE = 'evaluate("e")'

test('here, every sandbox stays as written', () => {
  for (const sandbox of [
    { kind: 'docker' },
    { kind: 'docker', engine: 'podman' },
    { kind: 'tart', image: 'macos-base' },
    { kind: 'fake' },
  ] as SandboxDescriptor[]) {
    assert.equal(place(sandbox, 'here', WHERE), sandbox)
  }
})

test('on a cloud run, docker() is the same container on a VM of its own, sized by the scheduler', () => {
  assert.deepEqual(place({ kind: 'docker', id: 'docker' }, 'cloud', WHERE), {
    kind: 'cloud',
    reevalImage: true,
  })
  assert.deepEqual(
    place(
      {
        kind: 'docker',
        engine: 'docker',
        from: 'debian:12',
        install: ['apt-get install -y jq'],
        root: true,
        capabilities: ['NET_RAW'],
        memory: '2g',
        cpus: 1,
        pids: 512,
        maxConcurrent: 4,
      },
      'cloud',
      WHERE,
    ),
    {
      kind: 'cloud',
      from: 'debian:12',
      install: ['apt-get install -y jq'],
      root: true,
      capabilities: ['NET_RAW'],
      memory: '2g',
      cpus: 1,
      pids: 512,
      maxConcurrent: 4,
    },
  )
})

test('on a cloud run, a sandbox already on VMs, or the fake one, stays as written', () => {
  for (const sandbox of [
    { kind: 'fake' },
    { kind: 'cloud', size: 'large' },
    { kind: 'boat', apiKey: { kind: 'secret', from: 'BOAT_API_KEY' }, prefix: 'r' },
  ] as SandboxDescriptor[]) {
    assert.equal(place(sandbox, 'cloud', WHERE), sandbox)
  }
})

test('on a cloud run, tart() and podman() are refused, with no run here instead', () => {
  assert.throws(
    () => place({ kind: 'tart', image: 'macos-base' }, 'cloud', WHERE),
    (e: unknown) => e instanceof CloudUnsupported && /^evaluate\("e"\): tart\(\)/.test(e.message),
  )
  assert.throws(
    () => place({ kind: 'docker', engine: 'podman' }, 'cloud', WHERE),
    (e: unknown) => e instanceof CloudUnsupported && /podman\(\)/.test(e.message),
  )
})

test("a cloud container's limits are its VM's share per slot, which it may lower but not pass", () => {
  const share = { memoryBytes: 2 * 1024 ** 3, cpus: 1 }
  assert.deepEqual(slotLimits(share, {}), { memory: share.memoryBytes, cpus: 1 })
  assert.deepEqual(slotLimits(share, { memory: '1g', pids: 64 }), {
    memory: '1g',
    cpus: 1,
    pids: 64,
  })
  assert.deepEqual(slotLimits(null, { cpus: 4 }), { cpus: 4 })
  const held: string[] = []
  assert.deepEqual(
    slotLimits(share, { memory: '4g', cpus: 2, pids: 64 }, (l) => held.push(l)),
    {
      memory: share.memoryBytes,
      cpus: 1,
      pids: 64,
    },
  )
  assert.deepEqual(held, ['memory 4g held to its 2048m per slot', 'cpus 2 held to its 1 per slot'])
})
