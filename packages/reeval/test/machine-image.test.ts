import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { RemoteEngine } from '@reeval/sandbox-docker'
import { imageOnMachine } from '../src/sandbox/machine-image.ts'
import { PrepareError } from '../src/sandbox/provider.ts'
import { InfraError } from '../src/sandbox/types.ts'

/** A machine whose SSH refuses every connection. */
const unreachable = (id: string): RemoteEngine => ({
  kind: 'ssh',
  target: {
    host: '127.0.0.1',
    port: 1,
    user: 'reeval',
    identityFile: join(tmpdir(), 'no-such-key'),
    knownHostsFile: '/dev/null',
    hostKeyAlias: id,
    controlPath: join(mkdtempSync(join(tmpdir(), 'reeval-mi-')), 'cm'),
  },
  description: id,
})

test("a machine that can't be reached is its own infra error, not the recipe's", async () => {
  const recipe = { install: ['true'] }
  const harness = { kind: 'fake' } as const
  const fail = (id: string) =>
    imageOnMachine(
      recipe,
      harness,
      [],
      { id, description: `cloud VM ${id}` },
      unreachable(id),
      AbortSignal.timeout(60_000),
    ).then(
      () => assert.fail('prepared on an unreachable machine'),
      (error: unknown) => error,
    )
  const first = await fail('m1')
  assert.ok(first instanceof InfraError, String(first))
  assert.ok(!(first instanceof PrepareError), 'not classed as the recipe config')
  assert.match((first as Error).message, /^cloud VM m1 couldn't prepare the sandbox image: /)
  const second = await fail('m2')
  assert.match((second as Error).message, /^cloud VM m2 /, 'the next machine tries for itself')
})
