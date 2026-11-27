// `EvalError` and the trial's `failure`: what a task's throw records, how it prints and how it's
// queried. The fixture `history/eval-error` checks the same from inside a trial.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { recordTaskFailure } from '../src/trial/record.ts'
import type { Trial } from '../src/trial/state.ts'
// biome-ignore lint/suspicious/noShadowRestrictedNames: reeval's EvalError stands in for the global one
import { EvalError } from '../src/eval-error.ts'
import { errorFrom } from '../src/language-runner/transport.ts'
import type { EvalRecord } from '../src/types.ts'
import { fakeConfig, project, readRun, runCli } from './helpers.ts'

function failed(error: unknown, turns = 1) {
  const record = { error: { kind: 'assertion', message: String(error) } } as EvalRecord
  const a = { record, turns: Array(turns).fill({}) } as unknown as Trial
  recordTaskFailure(a, error, '/project')
  return record
}

describe('EvalError', () => {
  test('takes a reason, or a reason with meta and cause', () => {
    const cause = new Error('exit 1')
    const e = new EvalError({ reason: 'the build fails', meta: { exitCode: 1 }, cause })
    assert.deepEqual(
      [e.name, e.message, e.reason, e.meta, e.cause],
      ['EvalError', 'the build fails', 'the build fails', { exitCode: 1 }, cause],
    )
    assert.equal(new EvalError('no tests ran').meta, undefined)
  })

  test('refuses an empty reason and meta that is not a JSON object', () => {
    assert.throws(() => new EvalError(' '), /EvalError takes a reason/)
    assert.throws(() => new EvalError({ reason: 'x', meta: [1] as never }), /takes a JSON object/)
    assert.throws(
      () => new EvalError({ reason: 'x', meta: { at: new Date() } as never }),
      /EvalError meta takes JSON/,
    )
  })

  test("a runner's EvalError comes back as one, with its meta and stack", () => {
    const back = errorFrom({
      name: 'EvalError',
      message: 'the build fails',
      meta: { exit_code: 1 },
      stack: 'Traceback (most recent call last): …',
    })
    assert.ok(back instanceof EvalError)
    assert.deepEqual(
      [back.reason, back.meta, back.stack],
      ['the build fails', { exit_code: 1 }, 'Traceback (most recent call last): …'],
    )
  })
})

describe("the trial's failure", () => {
  test("an EvalError records its reason, masked meta, turn and stack, and is the error's message", () => {
    const error = new EvalError({
      reason: 'the build\nfails',
      meta: { exitCode: 2, token: `ghp_${'a'.repeat(36)}` },
    })
    error.stack = 'EvalError: the build\nfails\n    at task (/project/evals/a.eval.ts:3:9)'
    const record = failed(error, 2)
    assert.deepEqual(record.failure, {
      kind: 'task',
      reason: 'the build fails',
      meta: { exitCode: 2, token: '[REDACTED]' },
      turn: 2,
      stack: 'EvalError: the build\nfails\n    at task (evals/a.eval.ts:3:9)',
    })
    assert.equal(record.error?.message, 'the build fails')
  })

  test('a plain error records its message on one line, clipped, with its class', () => {
    const error = new TypeError(`x is ${'undefined '.repeat(40)}`)
    const record = failed(error, 0)
    assert.equal(record.failure?.name, 'TypeError')
    assert.equal(record.failure?.turn, 0)
    assert.equal(record.failure?.meta, undefined)
    assert.match(record.failure?.reason ?? '', /^x is (undefined )+undefined…$/)
    assert.ok((record.failure?.reason.length ?? 0) <= 200)
    assert.equal(record.error?.message, String(error))
    const global = failed(new globalThis.EvalError('not reeval’s'))
    assert.deepEqual([global.failure?.name, global.failure?.reason], ['EvalError', 'not reeval’s'])
  })

  test("the stack carries the error's causes, as Python's traceback does", () => {
    const parse = new SyntaxError('Unexpected token } in JSON')
    parse.stack = 'SyntaxError: Unexpected token } in JSON\n    at JSON.parse (<anonymous>)'
    const error = new EvalError({ reason: 'config unreadable', cause: parse })
    error.stack = 'EvalError: config unreadable\n    at task (/project/evals/a.eval.ts:4:11)'
    assert.equal(
      failed(error).failure?.stack,
      'EvalError: config unreadable\n    at task (evals/a.eval.ts:4:11)\nCaused by: SyntaxError: Unexpected token } in JSON\n    at JSON.parse (<anonymous>)',
    )
    const looped = new Error('a', { cause: 'not an error' })
    assert.match(failed(looped).failure?.stack ?? '', /\nCaused by: not an error$/)
  })

  test('meta past 4 KiB of JSON is recorded as how big it was', () => {
    const error = new EvalError({ reason: 'x', meta: { stderr: 'y'.repeat(5000) } })
    assert.deepEqual(failed(error).failure?.meta, { truncated: true, bytes: 5013 })
  })

  test('the reason drops escape sequences and control characters', () => {
    // Node 22.16 strips `ESC [ 2Jbuild BEL` as one sequence, so the BEL isn't right after `build`.
    const error = new EvalError('\u001b[2Jbuild failed\u0007\u2028at\tlast')
    assert.equal(failed(error).failure?.reason, 'build failed  at last')
  })

  test("JavaScript's own EvalError, given reeval's options, says to import reeval's", () => {
    const error = new globalThis.EvalError({ reason: 'x' } as never)
    assert.match(
      failed(error).failure?.reason ?? '',
      /^EvalError isn't reeval's: import \{ EvalError \}/,
    )
  })

  test("a trial whose error isn't the task's has no task failure", () => {
    const error = new Error('expected 1 to be 2')
    const infra = { error: { kind: 'infra', message: 'x' } } as EvalRecord
    recordTaskFailure({ record: infra, turns: [] } as unknown as Trial, error, '/project')
    assert.equal(infra.failure, undefined)
  })

  test('prints the reason, meta and turn, is recorded and queryable', async () => {
    const p = await project('eval-error-run', {
      'reeval.config.ts': fakeConfig(),
      'evals/a.eval.ts': `import { defineEval, EvalError } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('x')
    const r = await c.exec('echo boom >&2; exit 3')
    throw new EvalError({ reason: 'the build fails', meta: { exitCode: r.exitCode, stderr: r.stderr.trim() } })
  },
})
`,
      'evals/b.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  async task() {
    const x: { y?: () => void } = {}
    x.y!()
  },
})
`,
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 1, r.stdout + r.stderr)
    assert.match(
      r.stdout,
      /#1 {2}0% {2}the build fails\n +exitCode: 3\n +stderr: boom\n +after turn 1\n/,
    )
    assert.match(
      r.stdout,
      /#1 {2}0% {2}TypeError: x\.y is not a function\n +before the first turn\n +at task \(evals\/b\.eval\.ts:5:\d+\)/,
    )
    const { run } = readRun(p.dir)
    const [a, b] = run.evals.map((e) => e.trials[0]?.failure)
    assert.deepEqual(
      { ...a, stack: undefined },
      {
        kind: 'task',
        reason: 'the build fails',
        meta: { exitCode: 3, stderr: 'boom' },
        turn: 1,
        stack: undefined,
      },
    )
    assert.match(
      a?.stack ?? '',
      /^EvalError: the build fails\n +at task \(evals\/a\.eval\.ts:6:\d+\)/,
    )
    assert.equal(b?.name, 'TypeError')
    const q = await runCli(p.dir, [
      'query',
      'SELECT eval_key, reason FROM failing_trials ORDER BY eval_key',
      '--json',
    ])
    assert.equal(q.code, 0, q.stderr)
    assert.deepEqual(
      JSON.parse(q.stdout).map((x: { reason: string }) => x.reason),
      ['the build fails', 'x.y is not a function'],
    )
    const m = await runCli(p.dir, [
      'query',
      'SELECT key, kind, num, text, turn, reason, outcome FROM failure_meta ORDER BY key',
      '--json',
    ])
    assert.equal(m.code, 0, m.stderr)
    assert.deepEqual(JSON.parse(m.stdout), [
      {
        key: 'exitCode',
        kind: 'number',
        num: 3,
        text: null,
        turn: 1,
        reason: 'the build fails',
        outcome: 'fail',
      },
      {
        key: 'stderr',
        kind: 'string',
        num: null,
        text: 'boom',
        turn: 1,
        reason: 'the build fails',
        outcome: 'fail',
      },
    ])
  })
})
