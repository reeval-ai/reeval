import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { cloud } from '../src/internal-vm.ts'
import { plannedSandboxIds } from '../src/options.ts'
import { boat, createBoat } from '../src/provider-boat.ts'
import { daytona } from '../src/provider-daytona.ts'
import { CloudUnsupported, place } from '../src/sandbox/place.ts'
import { slotLimits } from '../src/sandbox/vm-container.ts'
import { docker, fakeSandbox, podman, tart } from '../src/sandbox.ts'
import type { SandboxDescriptor } from '../src/types.ts'

const where = 'evals/a.eval.ts › a'

describe('place()', () => {
  test('no provider leaves every sandbox on this machine', () => {
    for (const s of [docker(), podman(), tart({ image: 'macos' }), fakeSandbox(), cloud()]) {
      assert.equal(place(s, undefined, 'here', where), s)
    }
  })

  test("docker() without a recipe goes on the provider's machines in reeval's image", () => {
    assert.deepEqual(place(docker(), boat(), 'here', where), boat())
    assert.deepEqual(
      place(docker(), daytona({ size: 'large' }), 'here', where),
      daytona({ size: 'large' }),
    )
  })

  test('the recipe, the id and maxConcurrent carry; the provider caps first', () => {
    const s = docker({
      id: 'web',
      from: 'node:24',
      install: ['apt-get install -y jq'],
      maxConcurrent: 2,
    })
    assert.deepEqual(place(s, createBoat({ prefix: 'team' })({ type: 'large' }), 'here', where), {
      kind: 'boat',
      apiKey: { kind: 'secret', from: 'BOAT_API_KEY' },
      prefix: 'team',
      type: 'large',
      id: 'web',
      from: 'node:24',
      install: ['apt-get install -y jq'],
      maxConcurrent: 2,
    })
    assert.equal(place(s, daytona({ maxConcurrent: 5 }), 'here', where).maxConcurrent, 5)
    assert.deepEqual(place(docker({ image: 'ghcr.io/acme/app:1' }), daytona(), 'here', where), {
      ...daytona(),
      image: 'ghcr.io/acme/app:1',
    })
  })

  test('a provider places docker() on its machines on a cloud run too, and refuses with its own words', () => {
    assert.deepEqual(place(docker({ from: 'node:24' }), boat(), 'cloud', where), {
      ...boat(),
      from: 'node:24',
    })
    assert.throws(
      () => place(tart({ image: 'macos' }), boat(), 'cloud', where),
      (e: unknown) =>
        !(e instanceof CloudUnsupported) && /boat\(\) runs docker\(\) sandboxes/.test(String(e)),
    )
  })

  test('the fake sandbox and the machine kinds pass through', () => {
    for (const s of [fakeSandbox(), cloud()]) assert.equal(place(s, boat(), 'here', where), s)
  })

  test('podman(), tart() and options for a local container are refused', () => {
    assert.throws(
      () => place(podman(), boat(), 'here', where),
      /^UsageError: evals\/a\.eval\.ts › a: boat\(\) runs docker\(\) sandboxes, not podman\(\)\.$/,
    )
    assert.throws(
      () => place(tart({ image: 'macos' }), daytona(), 'here', where),
      /daytona\(\) runs docker\(\) sandboxes, not tart\(\)\./,
    )
    assert.throws(
      () => place(docker({ memory: '4g' }), boat(), 'here', where),
      /docker\(\{ memory \}\) applies to a container on your machine, not on boat\(\): boat\(\{ type \}\) sets the machine's size\. Leave it out\.$/,
    )
    assert.throws(
      () => place(docker({ memory: '4g', cpus: 2 }), boat(), 'here', where),
      /docker\(\{ memory, cpus \}\) .* Leave them out\.$/,
    )
    assert.throws(
      () => place(docker({ root: true }), boat(), 'here', where),
      /docker\(\{ root \}\) applies to a container on your machine, not on boat\(\): the agent runs as the reeval user\. Leave it out\.$/,
    )
    assert.equal(
      place(docker({ root: false, capabilities: [] }), boat(), 'here', where).kind,
      'boat',
    )
  })

  test("the run header names the provider each placed sandbox runs on, and not the fake one's", () => {
    const placed = [docker({ from: 'node:24' }), docker(), fakeSandbox()].map((s) =>
      place(s, boat(), 'here', where),
    )
    const ids = (sandboxes: typeof placed) =>
      sandboxes.map((s, i) =>
        s.kind === 'boat' ? { ...s, id: ['docker:node:24', 'docker'][i] } : s,
      )
    assert.deepEqual(plannedSandboxIds(ids(placed), docker(), boat()), [
      'docker:node:24 on boat()',
      'docker on boat()',
      'fake',
    ])
    assert.deepEqual(plannedSandboxIds([docker()], docker()), ['docker'])
  })
})

const WHERE = 'evaluate("e")'

test('here, every sandbox stays as written', () => {
  for (const sandbox of [
    { kind: 'docker' },
    { kind: 'docker', engine: 'podman' },
    { kind: 'tart', image: 'macos-base' },
    { kind: 'fake' },
  ] as SandboxDescriptor[]) {
    assert.equal(place(sandbox, undefined, 'here', WHERE), sandbox)
  }
})

test('on a cloud run, docker() is the same container on a VM of its own, sized by the scheduler', () => {
  assert.deepEqual(place({ kind: 'docker', id: 'docker' }, undefined, 'cloud', WHERE), {
    kind: 'cloud',
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
      undefined,
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
    assert.equal(place(sandbox, undefined, 'cloud', WHERE), sandbox)
  }
})

test('on a cloud run, tart() and podman() are refused, with no run here instead', () => {
  assert.throws(
    () => place({ kind: 'tart', image: 'macos-base' }, undefined, 'cloud', WHERE),
    (e: unknown) => e instanceof CloudUnsupported && /^evaluate\("e"\): tart\(\)/.test(e.message),
  )
  assert.throws(
    () => place({ kind: 'docker', engine: 'podman' }, undefined, 'cloud', WHERE),
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
