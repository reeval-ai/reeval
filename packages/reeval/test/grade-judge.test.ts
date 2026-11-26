// Judge graders: their definition and refusals, the state the judge sees (inputs, reference,
// masking), their grades and scores over one or several models, and their fingerprints.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, relative, sep } from 'node:path'
import { describe, test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { writeTar } from '@reeval/sandbox-docker'
import { APICallError, Experimental_DecisionRefusalError, RetryError } from 'ai'
import { vercelDecisionModel } from '../src/gateway/vercel-models.ts'
import type { GradeInputs } from '../src/grade/context.ts'
import { defineGrader, type GraderDef, graderDef } from '../src/grade/define.ts'
import { judge } from '../src/grade/judge-grader.ts'
import { runGraders } from '../src/grade/run.ts'
import type { Grader } from '../src/grade/types.ts'
import { keptFiles } from '../src/history/stored-attempt.ts'
import { sha256 } from '../src/ids.ts'
import { askJudge } from '../src/judge/index.ts'
import { fakeJudge } from '../src/judge.ts'
import { InfraError } from '../src/sandbox/types.ts'
import type { GradeRecord, JudgeModel, JudgeState } from '../src/types.ts'
import { tempDir } from './helpers.ts'

const SECRET = `ghp_${'a1B2'.repeat(9)}`

/** An attempt that wrote `files`, and every state the judge was asked about. */
function attempt(files: Record<string, string> = {}, model?: JudgeModel) {
  const entries = Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))
  const manifest = {
    schemaVersion: 1 as const,
    files: entries.map(([path, text]) => ({
      path,
      sha256: sha256(Buffer.from(text)),
      bytes: text.length,
    })),
  }
  const archive = gzipSync(
    writeTar(
      entries.map(([path, text]) => ({
        type: 'file' as const,
        path,
        mode: 0o644,
        mtime: 0,
        data: Buffer.from(text),
      })),
    ),
  )
  const asked: Array<{ question: string; state: string; model: JudgeModel }> = []
  const inputs: GradeInputs = {
    case: { key: 'one', solution: 'a' } as GradeInputs['case'],
    turns: [
      {
        prompt: 'fix it',
        text: `done, token ${SECRET}`,
        status: 'completed',
        startedAt: '2026-01-01T00:00:00.000Z',
        durationMs: 1,
        trajectory: [],
        usage: null,
      } as unknown as GradeInputs['turns'][number],
    ],
    stored: {
      execs: [
        {
          command: 'npm test',
          label: 'tests',
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
          durationMs: 1,
        },
      ],
      observations: [{ name: 'total', value: 3, turn: 1, sha256: sha256(JSON.stringify(3)) }],
      artifacts: [],
      readArtifact: async () => null,
      workspace: entries.length ? keptFiles(manifest, archiveFile(archive)) : null,
      changedFiles: [],
      diff: { patch: '+export const answer = 42\n', files: [] },
    },
    judge: {
      ...(model !== undefined ? { model } : {}),
      ask: (question, answers, state, m, signal) => {
        asked.push({ question, state: JSON.stringify(state), model: m })
        return askJudge(question, answers, state, { model: m }, signal)
      },
    },
  }
  return { inputs, asked }
}

function archiveFile(archive: Buffer): string {
  const file = join(tempDir('grade-judge-kept'), 'workspace.tar.gz')
  writeFileSync(file, archive)
  return file
}

const def = (g: Grader): GraderDef => graderDef(g) as GraderDef

async function grade(g: Grader, inputs: GradeInputs): Promise<GradeRecord> {
  return (await runGraders([def(g)], inputs, new AbortController().signal))[0] as GradeRecord
}

describe('a judge grader', () => {
  test('grades a yes/no question with the answer, and yes scores 1', async () => {
    const { inputs, asked } = attempt({ 'src/app.js': 'export const answer = 42\n' })
    const g = judge('Is it right?', {
      inputs: { contents: ['src/**'] },
      model: fakeJudge({ score: 0.8 }),
    })
    const r = await grade(g, inputs)
    assert.deepEqual([r.grader, r.kind, r.grade, r.score], ['judge:Is it right?', 'judge', true, 1])
    assert.deepEqual(r.judge?.calls, [{ model: 'fake', answer: true, probability: 0.8 }])
    assert.deepEqual(
      r.reads.files?.map((f) => f.path),
      ['src/app.js'],
    )
    assert.match(asked[0]?.state ?? '', /export const answer = 42/)
    const no = await grade(
      judge('Is it right?', { inputs: { diff: true }, model: fakeJudge({ score: 0.2 }) }),
      inputs,
    )
    assert.deepEqual([no.grade, no.score], [false, 0])
  })

  test("shows the judge the stored attempt, masked, with the eval's model", async () => {
    const { inputs, asked } = attempt({}, fakeJudge())
    const r = await grade(
      defineGrader('all', {
        judge: {
          question: 'Did it test?',
          inputs: { output: true, diff: true, checks: true, observations: ['total'] },
        },
      }),
      inputs,
    )
    assert.equal(r.error, undefined)
    const state = asked[0]?.state ?? ''
    assert.doesNotMatch(state, /ghp_a1B2/, 'masked')
    assert.match(state, /done, token/)
    assert.match(state, /\+export const answer = 42/)
    assert.match(state, /npm test/)
    assert.match(state, /"total"/)
    assert.deepEqual(r.reads.observations, [{ name: 'total', sha256: sha256('3') }])
  })

  test('errors naming the fix when nothing gives it a model', async () => {
    const { inputs } = attempt()
    const r = await grade(judge('Q?', { inputs: { output: true } }), inputs)
    assert.match(r.error ?? '', /^judge grader judge:Q\? has no model\. Set judge: \{ model:/)
    assert.equal(r.score, 0)
  })

  test('errors when it names an observation the attempt never made', async () => {
    const { inputs } = attempt()
    const r = await grade(
      judge('Q?', { inputs: { observations: ['nope'] }, model: fakeJudge() }),
      inputs,
    )
    assert.match(r.error ?? '', /observations names a value this attempt didn't observe: "nope"/)
  })

  test('answers one of its answers per model, scored by the mean of its score map', async () => {
    const { inputs } = attempt()
    const g = judge('How readable?', {
      answers: ['good', 'okay', 'poor'],
      score: { good: 1, okay: 0.5, poor: 0 },
      inputs: { diff: true },
      models: [fakeJudge({ answer: 'good' }), fakeJudge({ answer: 'okay' })],
    })
    const r = await grade(g, inputs)
    assert.deepEqual([r.grade, r.score], [['good', 'okay'], 0.75])
    assert.equal(r.scoreDigest, sha256(JSON.stringify({ good: 1, okay: 0.5, poor: 0 })))
  })

  test('records answers with no score map unscored', async () => {
    const { inputs } = attempt()
    const r = await grade(
      judge('Tone?', {
        answers: ['terse', 'chatty'],
        inputs: { output: true },
        model: fakeJudge({
          answer: (state) => (JSON.stringify(state).includes('done') ? 'terse' : 'chatty'),
        }),
      }),
      inputs,
    )
    assert.deepEqual([r.grade, r.score, r.scoreDigest], ['terse', null, undefined])
  })

  test("errors when the judge's answer isn't one of its answers", async () => {
    const { inputs } = attempt()
    const r = await grade(
      judge('Tone?', {
        answers: ['terse', 'chatty'],
        inputs: { output: true },
        model: fakeJudge(),
      }),
      inputs,
    )
    assert.match(r.error ?? '', /fakeJudge\(\) answered undefined, not one of "terse", "chatty"/)
  })

  test('errors when any of its models fails, naming it', async () => {
    const { inputs } = attempt()
    inputs.judge = { ask: async () => Promise.reject(new Error(`401 for key ${SECRET}`)) }
    const r = await grade(
      judge('Q?', { inputs: { output: true }, models: ['openai/gpt-6', 'google/gemini-4'] }),
      inputs,
    )
    assert.match(r.error ?? '', /^openai\/gpt-6: 401 for key/)
    assert.doesNotMatch(r.error ?? '', /ghp_a1B2/)
  })

  test("keeps the other models' calls when one fails", async () => {
    const { inputs } = attempt()
    const usage = { inputTokens: 10, outputTokens: 2 } as never
    inputs.judge = {
      ask: async (_q, _a, _s, model) =>
        model === 'google/gemini-4'
          ? Promise.reject(new Error('503'))
          : { answer: true, model: 'openai/gpt-6', costUsd: 0.01, usage, retries: [] },
    }
    const r = await grade(
      judge('Q?', { inputs: { output: true }, models: ['openai/gpt-6', 'google/gemini-4'] }),
      inputs,
    )
    assert.match(r.error ?? '', /^google\/gemini-4: 503/)
    assert.deepEqual(
      r.judge?.calls?.map((c) => [c.model, c.costUsd]),
      [['openai/gpt-6', 0.01]],
    )
  })
})

describe("a judge grader's failed call", () => {
  const url = 'https://api.example.test/v1/decide'
  const failing = (error: unknown) => {
    const { inputs } = attempt({}, 'openai/gpt-6')
    inputs.judge = { ...inputs.judge, ask: async () => Promise.reject(error) }
    return inputs
  }
  const unavailable = new APICallError({
    message: `Service Unavailable for ${SECRET}`,
    url,
    requestBodyValues: {},
    statusCode: 503,
  })

  for (const [what, error] of [
    ['a 5xx', unavailable],
    [
      'a network error',
      new APICallError({
        message: 'Cannot connect to API: ECONNRESET',
        url,
        requestBodyValues: {},
        isRetryable: true,
      }),
    ],
    [
      "the AI SDK's retries of a 5xx",
      new RetryError({
        message: 'Failed after 3 attempts',
        reason: 'maxRetriesExceeded',
        errors: [unavailable],
      }),
    ],
  ] as const) {
    test(`is the attempt's infra error for ${what}, masked`, async () => {
      await assert.rejects(
        grade(judge('Q?', { name: 'q', inputs: { output: true } }), failing(error)),
        (e: Error) => {
          assert.ok(e instanceof InfraError)
          assert.match(e.message, /^The judge's provider failed judge grader q on openai\/gpt-6: /)
          assert.doesNotMatch(e.message, /ghp_a1B2/)
          return true
        },
      )
    })
  }

  test("is the attempt's infra error for Vercel AI Gateway's 5xx, and the grade's for its 400", async () => {
    const server = createServer((req, res) => {
      req.resume().on('end', () => {
        const status = req.headers.authorization === 'Bearer bad-request' ? 400 : 503
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({ error: { message: `status ${status}`, type: 'internal_server_error' } }),
        )
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const retryMs = process.env.REEVAL_TEST_JUDGE_RETRY_MS
    process.env.REEVAL_TEST_JUDGE_RETRY_MS = '1'
    const on = (apiKey: string) =>
      vercelDecisionModel('typesafe-ai/jev-1.14.0', {
        baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/ai`,
        apiKey,
      }) as JudgeModel
    try {
      await assert.rejects(
        grade(judge('Q?', { name: 'q', inputs: { output: true } }), attempt({}, on('down')).inputs),
        (e: Error) =>
          e instanceof InfraError &&
          /^The judge's provider failed judge grader q on gateway\/typesafe-ai\/jev-1\.14\.0: /.test(
            e.message,
          ),
      )
      const r = await grade(
        judge('Q?', { inputs: { output: true } }),
        attempt({}, on('bad-request')).inputs,
      )
      assert.equal(r.score, 0)
      assert.match(r.error ?? '', /status 400/)
    } finally {
      if (retryMs === undefined) delete process.env.REEVAL_TEST_JUDGE_RETRY_MS
      else process.env.REEVAL_TEST_JUDGE_RETRY_MS = retryMs
      server.close()
    }
  })

  test('clips a long provider message, as a grade error is', async () => {
    const long = new APICallError({
      message: 'x'.repeat(10_000),
      url,
      requestBodyValues: {},
      statusCode: 502,
    })
    await assert.rejects(
      grade(judge('Q?', { name: 'q', inputs: { output: true } }), failing(long)),
      (e: Error) => e instanceof InfraError && e.message.length < 2200,
    )
  })

  test("is the attempt's infra error when the judge times out", async () => {
    const { inputs } = attempt({}, 'openai/gpt-6')
    inputs.judge = {
      ...inputs.judge,
      ask: (_q, _a, _s, _m, signal) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
    }
    await assert.rejects(
      grade(judge('Q?', { name: 'q', inputs: { output: true }, timeout: '50ms' }), inputs),
      (e: Error) =>
        e instanceof InfraError && e.message === 'The judge timed out after 50ms grading q',
    )
  })

  for (const [what, error, message] of [
    [
      'a refusal',
      new Experimental_DecisionRefusalError({
        questionIds: ['answer'],
        provider: 'openai',
        modelId: 'gpt-6',
        message: 'refused',
      }),
      /^openai\/gpt-6: refused$/,
    ],
    [
      'a malformed answer',
      new APICallError({
        message: 'Invalid JSON response',
        url,
        requestBodyValues: {},
        statusCode: 200,
      }),
      /^openai\/gpt-6: Invalid JSON response$/,
    ],
    [
      'a 400',
      new APICallError({ message: 'Bad Request', url, requestBodyValues: {}, statusCode: 400 }),
      /^openai\/gpt-6: Bad Request$/,
    ],
  ] as const) {
    test(`is the grade's error, scored 0, for ${what}`, async () => {
      const r = await grade(judge('Q?', { inputs: { output: true } }), failing(error))
      assert.equal(r.score, 0)
      assert.match(r.error ?? '', message)
    })
  }
})

describe("a judge grader's reference", () => {
  const dir = tempDir('judge-reference-')
  mkdirSync(join(dir, 'a/src'), { recursive: true })
  mkdirSync(join(dir, 'b/src'), { recursive: true })
  writeFileSync(join(dir, 'a/src/app.js'), 'export const answer = 42\n')
  writeFileSync(join(dir, 'b/src/app.js'), 'export const answer = 41\n')
  writeFileSync(join(dir, 'b/logo.png'), Buffer.from([0x89, 0, 1]))
  writeFileSync(join(dir, 'notes.md'), `Expect 42. ${SECRET}\n`)
  const files = { 'src/app.js': 'export const answer = 42\n' }

  test('shows text or a file whole, masked', async () => {
    const { inputs, asked } = attempt(files)
    await grade(
      defineGrader('notes', ({ file }) => ({
        judge: {
          question: 'Q?',
          inputs: { reference: 'whole' },
          reference: file(join(dir, 'notes.md')),
          model: fakeJudge(),
        },
      })),
      inputs,
    )
    const state = JSON.parse(asked[0]?.state ?? '{}')
    const key = relative(import.meta.dirname, join(dir, 'notes.md'))
      .split(sep)
      .join('/')
    assert.deepEqual(Object.keys(state.reference), [key])
    assert.match(state.reference[key], /^Expect 42\. /)
    assert.doesNotMatch(asked[0]?.state ?? '', /ghp_a1B2/)
  })

  test('keys a file by its path from the grader, not its basename', async () => {
    const { inputs, asked } = attempt(files)
    await grade(
      judge('Q?', ({ file }) => ({
        inputs: { reference: 'whole' },
        reference: file('refusals/cases.ts'),
        model: fakeJudge(),
      })),
      inputs,
    )
    assert.deepEqual(Object.keys(JSON.parse(asked[0]?.state ?? '{}').reference), [
      'refusals/cases.ts',
    ])
  })

  test("diffs each file against the attempt's, per case", async () => {
    const { inputs, asked } = attempt(files)
    const g = defineGrader<{ solution: string }>('matches', ({ directory }) => ({
      judge: {
        question: 'Does it match?',
        inputs: { reference: 'diff' },
        reference: (item) => directory(join(dir, item.solution)),
        model: fakeJudge(),
      },
    }))
    const same = await grade(g, inputs)
    assert.deepEqual(JSON.parse(asked[0]?.state ?? '{}').reference, {
      'src/app.js': '[reeval: unchanged]',
    })
    assert.equal(same.judge?.reference?.files, 1)
    assert.deepEqual(
      same.reads.files?.map((f) => f.path),
      ['src/app.js'],
    )
    inputs.case = { key: 'two', solution: 'b' } as GradeInputs['case']
    const other = await grade(g, inputs)
    const reference = JSON.parse(asked[1]?.state ?? '{}').reference
    assert.equal(reference['logo.png'], '[reeval: binary file not shown]')
    assert.match(reference['src/app.js'], /^-export const answer = 41$/m)
    assert.match(reference['src/app.js'], /^\+export const answer = 42$/m)
    assert.equal(other.judge?.reference?.files, 2)
    assert.notEqual(other.fingerprint.reference, same.fingerprint.reference)
    assert.equal(other.fingerprint.code, same.fingerprint.code)
    assert.notEqual(other.fingerprint.digest, same.fingerprint.digest)
  })

  test("names a reference file missing from the attempt's workspace", async () => {
    const { inputs, asked } = attempt({})
    await grade(
      judge('Q?', {
        inputs: { reference: 'diff' },
        reference: { 'src/app.js': { kind: 'file', path: join(dir, 'a/src/app.js') } },
        model: fakeJudge(),
      }),
      inputs,
    )
    assert.deepEqual(JSON.parse(asked[0]?.state ?? '{}').reference, {
      'src/app.js': "[reeval: not in the attempt's workspace]",
    })
  })

  test("errors when a case's reference directory doesn't exist", async () => {
    const { inputs } = attempt(files)
    inputs.case = { key: 'gone', solution: 'gone' } as GradeInputs['case']
    const r = await grade(
      defineGrader<{ solution: string }>('matches', ({ directory }) => ({
        judge: {
          question: 'Q?',
          inputs: { reference: 'whole' },
          reference: (item) => directory(join(dir, item.solution)),
          model: fakeJudge(),
        },
      })),
      inputs,
    )
    assert.match(r.error ?? '', /gone/)
    assert.equal(r.score, 0)
  })

  test('digests text by its content', async () => {
    const { inputs } = attempt()
    const g = (text: string) =>
      judge('Q?', { inputs: { reference: 'whole' }, reference: text, model: fakeJudge() })
    const [a, b, c] = [
      await grade(g('x'), inputs),
      await grade(g('x'), inputs),
      await grade(g('y'), inputs),
    ]
    assert.equal(a.fingerprint.reference, b.fingerprint.reference)
    assert.notEqual(a.fingerprint.reference, c.fingerprint.reference)
    assert.equal(a.judge?.reference?.files, 0)
  })
})

describe("a judge grader's fingerprint", () => {
  const spec = { question: 'Q?', inputs: { diff: true }, model: fakeJudge() }
  test('is its question, answers, inputs and models, not its score or weight', async () => {
    const { inputs } = attempt()
    const base = await grade(defineGrader('g', { judge: spec }), inputs)
    const weighted = await grade(
      defineGrader('g', { judge: spec, weight: 2, score: { true: 1, false: 0.5 } }),
      inputs,
    )
    assert.equal(weighted.fingerprint.digest, base.fingerprint.digest)
    assert.notEqual(weighted.scoreDigest, base.scoreDigest)
    for (const changed of [
      { ...spec, question: 'Other?' },
      { ...spec, inputs: { diff: true, output: true } },
      { ...spec, model: 'openai/gpt-6' },
    ]) {
      const { inputs: again } = attempt()
      again.judge = {
        ask: async (_q, _a, _s, model) => ({
          answer: true,
          model: String(model),
          retries: [],
          usage: null,
        }),
      }
      const other = await grade(defineGrader('g', { judge: changed }), again)
      assert.notEqual(other.fingerprint.code, base.fingerprint.code, JSON.stringify(changed))
    }
  })
  test('takes the revision', async () => {
    const { inputs } = attempt()
    const a = await grade(defineGrader('g', { judge: spec }), inputs)
    const b = await grade(defineGrader('g', { judge: spec, revision: 1 }), inputs)
    assert.equal(b.fingerprint.revision, 1)
    assert.notEqual(a.fingerprint.digest, b.fingerprint.digest)
  })
})

describe('judge()', () => {
  test("is named judge:<question> unless it's given a name", () => {
    assert.equal(judge('Is it ok?', { inputs: { diff: true } }).name, 'judge:Is it ok?')
    assert.equal(judge('Is it ok?', { name: 'ok', inputs: { diff: true } }).name, 'ok')
    assert.equal(judge('Is it ok?', { inputs: { diff: true } }).kind, 'judge')
  })
  test('puts a default name on one line of at most 80 characters', () => {
    const inputs = { diff: true }
    assert.equal(judge('Is it\n  ok?', { inputs }).name, 'judge:Is it ok?')
    const long = judge(`Is ${'very '.repeat(30)}ok?`, { inputs }).name
    assert.equal(long.length, 80)
    assert.match(long, /^judge:Is very very .*~[0-9a-f]{8}$/)
    assert.notEqual(long, judge(`Is ${'very '.repeat(31)}ok?`, { inputs }).name)
  })
  test("checks a given name as defineGrader's", () =>
    assert.throws(
      () => judge('Q?', { name: 'has space', inputs: { diff: true } }),
      /needs a name of/,
    ))
  test('takes the file and directory helpers', () => {
    const g = judge('Q?', ({ file }) => ({
      inputs: { reference: 'whole' },
      reference: file('grade-judge.test.ts'),
    }))
    assert.equal(def(g).run.kind, 'judge')
  })
})

describe('defining a judge grader refuses', () => {
  const refuses = (make: () => unknown, message: RegExp) => assert.throws(make, message)
  const inputs = { diff: true }
  test('grade with judge', () =>
    refuses(
      () => defineGrader('g', { judge: { question: 'Q?', inputs }, grade: () => 1 } as never),
      /takes grade or judge, not both/,
    ))
  test("a code grader's options", () =>
    refuses(
      () => defineGrader('g', { judge: { question: 'Q?', inputs }, files: ['a'] } as never),
      /doesn't take files\. A judge grader takes judge, score, weight, required, revision, timeout/,
    ))
  test('a missing question', () =>
    refuses(() => judge('', { inputs }), /needs a question: a non-empty string/))
  test('fewer than two answers, or one twice', () => {
    refuses(() => judge('Q?', { inputs, answers: ['a'] }), /two or more different answers/)
    refuses(() => judge('Q?', { inputs, answers: ['a', 'a'] }), /two or more different answers/)
  })
  test('model with models', () =>
    refuses(
      () => judge('Q?', { inputs, model: fakeJudge(), models: [fakeJudge()] }),
      /takes model or models, not both/,
    ))
  test('a model reeval reads no provider from', () =>
    refuses(() => judge('Q?', { inputs, models: ['gpt'] }), /judge\.models\[0\]/))
  test('inputs that show nothing', () =>
    refuses(() => judge('Q?', { inputs: {} }), /shows the judge nothing/))
  test('an unknown input', () =>
    refuses(() => judge('Q?', { inputs: { dif: true } as never }), /judge\.inputs/))
  test('inputs.reference with no reference', () =>
    refuses(
      () => judge('Q?', { inputs: { reference: 'whole' } }),
      /shows a reference, but the judge has none/,
    ))
  test("a reference file that isn't there", () =>
    refuses(
      () => judge('Q?', { inputs, reference: { kind: 'file', path: '/nope/x.md' } }),
      /reference in judge\("Q\?"\): \/nope\/x\.md doesn't exist/,
    ))
  test('a score map that misses an answer or adds one', () => {
    refuses(
      () => judge('Q?', { inputs, answers: ['a', 'b'], score: { a: 1 } }),
      /must give each answer a score in \[0, 1\].*\(no score for "b"\)/,
    )
    refuses(
      () => judge('Q?', { inputs, score: { yes: 1, true: 1, false: 0 } }),
      /\("yes" isn't one\)/,
    )
    refuses(() => judge('Q?', { inputs, score: { true: 2, false: 0 } }), /"true" has 2/)
  })
  test('required answers with no score', () =>
    refuses(
      () => judge('Q?', { inputs, answers: ['a', 'b'], required: true }),
      /is required but its answers have no score/,
    ))
})
