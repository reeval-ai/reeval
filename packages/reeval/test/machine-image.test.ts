import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  buildInstallLayer,
  ImageBuildError,
  type ImageStage,
  type RemoteEngine,
} from '@reeval/sandbox-docker'
import { imageOnMachine, recipeCaused } from '../src/sandbox/machine-image.ts'
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

test("a failed install, Dockerfile or plugin build step is the recipe's, a lost connection the machine's", () => {
  const failed = (stage: ImageStage) =>
    new ImageBuildError('step failed', {
      stage,
      ref: 'r',
      transient: false,
      cause: null,
      log: null,
    })
  for (const stage of ['install', 'dockerfile', 'plugin'] as const) {
    assert.ok(recipeCaused(failed(stage), 'exit code: 1'), stage)
  }
  assert.ok(!recipeCaused(failed('harness'), 'exit code: 1'), 'harness')
  assert.ok(!recipeCaused(failed('plugin'), 'ssh: connect to host: connection refused'))
})

test("what SSH prints when it loses the machine is the machine's, whatever the stage", () => {
  for (const line of [
    'Connection to 10.0.0.7 closed by remote host.',
    'Connection to 10.0.0.7 port 22 timed out',
    'Timeout, server 10.0.0.7 not responding.',
  ]) {
    for (const stage of ['install', 'dockerfile', 'plugin'] as const) {
      const error = new ImageBuildError(line, {
        stage,
        ref: 'r',
        transient: false,
        cause: null,
        log: null,
      })
      assert.ok(!recipeCaused(error, line), `${stage}: ${line}`)
    }
  }
})

test("an install build whose SSH session drops names the drop, so it's the machine's", async () => {
  const bin = mkdtempSync(join(tmpdir(), 'reeval-mi-bin-'))
  writeFileSync(
    join(bin, 'docker'),
    `#!/bin/sh
if [ "$1" = build ]; then
  cat >/dev/null
  echo '#5 [2/2] RUN /bin/sh -c reeval-install'
  echo '#5 0.412 installing'
  echo 'Connection to 10.0.0.7 closed by remote host.' >&2
  exit 255
fi
echo 'Error: No such image: reeval-install' >&2
exit 1
`,
    { mode: 0o755 },
  )
  const PATH = process.env.PATH
  process.env.PATH = `${bin}:${PATH}`
  try {
    const error = await buildInstallLayer({ ref: 'base:1', key: 'k' }, [{ run: 'true' }]).then(
      () => assert.fail('built'),
      (e: unknown) => e as Error,
    )
    assert.ok(error instanceof ImageBuildError, String(error))
    assert.match(
      error.message,
      /docker build failed: Connection to 10\.0\.0\.7 closed by remote host\./,
    )
    assert.ok(!recipeCaused(error, error.message))
  } finally {
    process.env.PATH = PATH
  }
})
