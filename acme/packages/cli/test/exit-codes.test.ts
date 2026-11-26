import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AcmeServices } from '@acme/core'
import { AcmeError } from '@acme/core'
import { recordingServices } from '@acme/core/testing'
import { exec } from './helpers.ts'

function failing(error: unknown): () => AcmeServices {
  const { services } = recordingServices()
  const fail = async () => {
    throw error
  }
  return () => ({ ...services, products: { ...services.products, get: fail } })
}

test('an AcmeError exits 1 with its code and message on stderr', async () => {
  const result = await exec(
    ['products', 'get', 'nope'],
    failing(new AcmeError('not_found', 'Product nope not found')),
  )
  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'error: not_found: Product nope not found\n')
  assert.equal(result.stdout, '')
})

test('an AcmeError with --json prints the envelope on stderr', async () => {
  const result = await exec(
    ['--json', 'products', 'get', 'nope'],
    failing(new AcmeError('not_found', 'Product nope not found')),
  )
  assert.equal(result.code, 1)
  assert.deepEqual(JSON.parse(result.stderr), {
    error: { code: 'not_found', message: 'Product nope not found' },
  })
  assert.equal(result.stdout, '')
})

test('an AcmeError with --json after the command prints the envelope on stderr', async () => {
  const result = await exec(
    ['products', 'get', 'nope', '--json'],
    failing(new AcmeError('not_found', 'Product nope not found')),
  )
  assert.equal(result.code, 1)
  assert.deepEqual(JSON.parse(result.stderr), {
    error: { code: 'not_found', message: 'Product nope not found' },
  })
  assert.equal(result.stdout, '')
})

test('a services factory that throws with --json exits 1 and leaves stdout empty', async () => {
  const result = await exec(['--json', 'reset'], () => {
    throw new Error('no key')
  })
  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
})

test('a connection error exits 1 with its message', async () => {
  const result = await exec(['products', 'get', 'x'], failing(new Error('connect ECONNREFUSED')))
  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'error: connect ECONNREFUSED\n')
})

test('a services factory that throws exits 1', async () => {
  const result = await exec(['reset'], () => {
    throw new Error('ACME_API_KEY is not set')
  })
  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'error: ACME_API_KEY is not set\n')
})

test('a thrown non-error exits 1', async () => {
  const result = await exec(['products', 'get', 'x'], failing('boom'))
  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'error: boom\n')
})

const usage = [
  ['a missing argument', ['products', 'get'], /missing required argument 'id'/],
  ['a missing required option', ['carts', 'update', 'c', 'p'], /--quantity/],
  ['a missing order option', ['orders', 'create', '--cart', 'c'], /--payment-token/],
  ['a non-integer --limit', ['products', 'list', '--limit', 'abc'], /not an integer/],
  ['a fractional --quantity', ['carts', 'add', 'c', 'p', '--quantity', '1.5'], /not an integer/],
  ['an unknown command', ['frobnicate'], /unknown command 'frobnicate'/],
  ['an unknown option', ['products', 'list', '--nope'], /unknown option '--nope'/],
  ['an extra argument', ['products', 'get', 'a', 'b'], /too many arguments/],
  ['a group with no subcommand', ['products'], /Usage:/],
  ['no arguments', [], /Usage: acme \[options\] \[command\]/],
  ['--version, which acme does not have', ['--version'], /unknown option '--version'/],
  ['a missing option value', ['carts', 'add', 'c', 'p', '--quantity'], /argument missing/],
] as const

for (const [name, argv, pattern] of usage) {
  test(`${name} exits 2 and calls no service`, async () => {
    const result = await exec([...argv])
    assert.equal(result.code, 2)
    assert.match(result.stderr, pattern)
    assert.equal(result.stdout, '')
    assert.deepEqual(result.calls, [])
  })
}

test('--help exits 0 without building the services', async () => {
  let built = 0
  for (const argv of [
    ['--help'],
    ['help'],
    ['help', 'orders'],
    ['products', '--help'],
    ['orders', 'create', '--help'],
  ]) {
    const result = await exec(argv, () => {
      built++
      throw new Error('no key')
    })
    assert.equal(result.code, 0)
    assert.match(result.stdout, /Usage: acme/)
    assert.equal(result.stderr, '')
  }
  assert.equal(built, 0)
})

test('a command help lists the global --json option', async () => {
  const result = await exec(['orders', 'list', '--help'])
  assert.match(result.stdout, /^Global Options:\n {2}--json /m)
})

test('--cursor help points at the next cursor line, the only cursor a list accepts', async () => {
  for (const group of ['products', 'orders']) {
    const result = await exec([group, 'list', '--help'])
    assert.match(
      result.stdout,
      /--cursor <c> +the "next cursor" line of the previous page\n/,
      group,
    )
  }
})
