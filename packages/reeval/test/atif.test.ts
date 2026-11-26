// ATIF export: `toAtif` on real runs from the record corpus against goldens in
// test/fixtures/atif/, each held to the Zod port of Harbor's trajectory validator (drift.yml holds
// the same goldens to Harbor's own), the port's refusals, and `reeval export` end to end.
import assert from 'node:assert/strict'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, test } from 'node:test'
import { openArchive } from '../src/archive/index.ts'
import type { RunRecord } from '../src/history/types.ts'
import { toAtif } from '../src/view/atif.ts'
import { trajectorySchema } from '../src/view/atif-schema.ts'
import { parseTrajectory } from '../src/view/model.ts'
import { readableRecord } from '../src/view/record.ts'
import { fakeConfig, project, runCli } from './helpers.ts'
import { CORPUS_DIR, HISTORY_DIR } from './support/corpus.ts'

const GOLDEN_DIR = join(import.meta.dirname, 'fixtures/atif')
const ENTRIES = ['real-harnesses', 'before-subagents', 'real-contract']
const update = process.env.REEVAL_UPDATE_SNAPSHOTS === '1'

/** Each attempt with a trajectory in an entry's runs, with its golden's path and its export. */
function exports(entry: string) {
  const history = join(CORPUS_DIR, entry, HISTORY_DIR)
  return readdirSync(history)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const run = readableRecord(JSON.parse(readFileSync(join(history, f), 'utf8')) as RunRecord)
      return run.evals.flatMap((e) =>
        e.attempts.flatMap((a) => {
          const path = a.files.trajectory?.path
          if (!path) return []
          const lines = parseTrajectory(readFileSync(join(history, run.runId, path), 'utf8'))
          const cell = path.split('/')[1] as string
          return [
            {
              runId: run.runId,
              path,
              golden: join(GOLDEN_DIR, entry, `${cell}.json`),
              text: `${JSON.stringify(toAtif(run, a, lines), null, 2)}\n`,
            },
          ]
        }),
      )
    })
}

describe('toAtif', () => {
  for (const entry of ENTRIES) {
    for (const x of exports(entry)) {
      test(`${entry}: ${x.golden.slice(GOLDEN_DIR.length + 1)}`, () => {
        const parsed = trajectorySchema.safeParse(JSON.parse(x.text))
        assert.ok(parsed.success, JSON.stringify(parsed.error?.issues, null, 2))
        if (update) {
          mkdirSync(dirname(x.golden), { recursive: true })
          writeFileSync(x.golden, x.text)
        }
        assert.equal(
          x.text,
          readFileSync(x.golden, 'utf8'),
          'REEVAL_UPDATE_SNAPSHOTS=1 rewrites it',
        )
      })
    }
  }

  test("leaves the eval's own c.decide calls out", () => {
    const history = join(CORPUS_DIR, 'with-decisions', HISTORY_DIR)
    const file = readdirSync(history).find((f) => f.endsWith('.json')) as string
    const run = readableRecord(JSON.parse(readFileSync(join(history, file), 'utf8')) as RunRecord)
    const attempts = run.evals.flatMap((e) => e.attempts)
    assert.equal(attempts.length, 2)
    for (const a of attempts) {
      const path = a.files.trajectory?.path as string
      const lines = parseTrajectory(readFileSync(join(history, run.runId, path), 'utf8'))
      assert.ok(
        lines.some((l) => l.type === 'decision'),
        path,
      )
      const atif = toAtif(run, a, lines)
      const parsed = trajectorySchema.safeParse(atif)
      assert.ok(parsed.success, JSON.stringify(parsed.error?.issues, null, 2))
      const without = toAtif(
        run,
        a,
        lines.filter((l) => l.type !== 'decision'),
      )
      assert.deepEqual(atif, without, path)
    }
  })

  test('embeds streamed subagents and refers to each from its spawn call', () => {
    const golden = join(GOLDEN_DIR, 'before-subagents')
    const t = JSON.parse(
      readFileSync(
        join(golden, readdirSync(golden).find((f) => f.startsWith('claude-code')) as string),
        'utf8',
      ),
    )
    const ids = t.subagent_trajectories.map((s: { trajectory_id: string }) => s.trajectory_id)
    const refs = t.steps.flatMap(
      (s: {
        observation?: {
          results: Array<{ subagent_trajectory_ref?: Array<{ trajectory_id: string }> }>
        }
      }) => (s.observation?.results ?? []).flatMap((r) => r.subagent_trajectory_ref ?? []),
    )
    assert.ok(ids.length > 0)
    assert.deepEqual(
      refs.map((r: { trajectory_id: string }) => r.trajectory_id).sort(),
      [...ids].sort(),
    )
  })

  test('turns, errors, web and edit calls, LLM calls, a bare input, and a subagent nested in a silent one', () => {
    const usage = (n: number) => ({ input: n, output: 1, cacheRead: 0, cacheWrite: 0 })
    const attempt = {
      key: 'e#cell#1',
      cell: 'cell',
      imageId: 'img',
      outcome: 'pass',
      usage: usage(30),
      activity: { llmCalls: 3 },
      turns: [
        { model: 'm', usage: usage(10) },
        { model: 'm', usage: usage(20) },
      ],
      subagents: [
        { id: 'A', prompt: 'a', model: 'm' },
        { id: 'B', parent: 'A', prompt: 'b', model: 'm' },
      ],
    }
    const run = {
      runId: 'r',
      stack: { images: [{ id: 'img', agentCli: '1.0' }] },
      evals: [{ cells: [{ key: 'cell', harnessKind: 'k', model: 'm' }], attempts: [attempt] }],
    }
    const ts = '2026-01-01T00:00:00.000Z'
    const at = (turn: number, line: Record<string, unknown>) => ({ turn, ts, atMs: 0, ...line })
    const lines = [
      at(0, { type: 'prompt', text: 'go' }),
      at(0, { type: 'retry', message: 'rate limited' }),
      at(0, { type: 'model-call', role: 'main' }),
      at(0, { type: 'model-call', role: 'side' }),
      at(0, { type: 'model-call', role: 'main' }),
      at(0, { type: 'tool', tool: 'Task', toolCallId: 'A', input: 'bare', output: { ok: 1 } }),
      at(0, { type: 'text', text: 'deep', subagent: 'B' }),
      at(0, { type: 'web-search', toolCallId: 'w1', query: 'q' }),
      at(0, { type: 'web-fetch', toolCallId: 'w2', url: 'https://x', status: 200 }),
      at(0, { type: 'turn-end', status: 'completed', durationMs: 1 }),
      at(1, { type: 'prompt', text: 'again' }),
      at(1, {
        type: 'file-edit',
        toolCallId: 'f',
        path: 'a.ts',
        kind: 'modify',
        added: 1,
        removed: 0,
      }),
      at(1, { type: 'model-call', role: 'main' }),
      at(1, { type: 'error', message: 'boom' }),
      at(1, { type: 'text', text: 'done' }),
    ]
    const t = toAtif(
      structuredClone(run) as unknown as RunRecord,
      structuredClone(attempt) as unknown as RunRecord['evals'][number]['attempts'][number],
      lines as never,
    )
    const parsed = trajectorySchema.safeParse(JSON.parse(JSON.stringify(t)))
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues, null, 2))
    assert.equal(t.agent.name, 'k')
    const agent = t.steps.filter((s) => s.source === 'agent')
    assert.deepEqual(
      agent.map((s) => s.tool_calls?.map((c) => [c.function_name, c.arguments]) ?? []),
      [
        [
          ['Task', { input: 'bare' }],
          ['web-search', { query: 'q' }],
          ['web-fetch', { url: 'https://x' }],
        ],
        [['file-edit', { path: 'a.ts' }]],
        [],
      ],
    )
    assert.deepEqual(agent[0]?.extra, { errors: [{ type: 'retry', message: 'rate limited' }] })
    assert.deepEqual(agent[1]?.extra, { errors: [{ type: 'error', message: 'boom' }] })
    assert.deepEqual(
      agent.map((s) => s.metrics?.prompt_tokens),
      [10, undefined, 20],
    )
    assert.deepEqual(
      agent.map((s) => s.llm_call_count),
      [2, undefined, 1],
    )
    const stepped = lines
      .filter((l) => l.type !== 'model-call')
      .map((l) => (l.type === 'web-search' ? { ...l, step: 2 } : l))
    assert.deepEqual(
      toAtif(run as unknown as RunRecord, attempt as never, stepped as never)
        .steps.filter((s) => s.source === 'agent')
        .map((s) => s.llm_call_count),
      [2, undefined, undefined],
    )
    const uncounted = { ...structuredClone(attempt), activity: { llmCalls: null } }
    const none = toAtif(run as unknown as RunRecord, uncounted as never, lines as never)
    assert.ok(none.steps.every((s) => s.llm_call_count === undefined))
    const [a] = t.subagent_trajectories ?? []
    assert.equal(a?.trajectory_id, 'A')
    assert.equal(a?.subagent_trajectories?.[0]?.steps.at(-1)?.message, 'deep')
  })
})

describe('the ATIF schema', () => {
  const step = (s: Record<string, unknown>) => ({ step_id: 1, source: 'agent', message: '', ...s })
  const doc = (t: Record<string, unknown>) => ({
    schema_version: 'ATIF-v1.7',
    agent: { name: 'a', version: '1' },
    steps: [step({})],
    ...t,
  })
  const refusals: Array<[string, Record<string, unknown>, RegExp]> = [
    ['an unknown key', { notes: 'x', other: 1 }, /Unrecognized key/],
    ['no steps', { steps: [] }, /too_small|>=1/],
    [
      'step ids out of order',
      { steps: [step({ step_id: 2 })] },
      /expected 1 \(sequential from 1\), got 2/,
    ],
    [
      'a result for a call another step made',
      {
        steps: [
          step({ tool_calls: [{ tool_call_id: 'a', function_name: 'f', arguments: {} }] }),
          step({ step_id: 2, observation: { results: [{ source_call_id: 'a' }] } }),
        ],
      },
      /source_call_id 'a' which is not found in step 2/,
    ],
    [
      'a subagent without a trajectory id',
      { subagent_trajectories: [doc({})] },
      /trajectory_id is required for embedded subagents/,
    ],
    [
      'two subagents with one trajectory id',
      { subagent_trajectories: [doc({ trajectory_id: 's' }), doc({ trajectory_id: 's' })] },
      /'s' is not unique/,
    ],
    [
      'a subagent ref that resolves to nothing',
      {
        steps: [
          step({ observation: { results: [{ subagent_trajectory_ref: [{ session_id: 'x' }] }] } }),
        ],
      },
      /must be resolvable/,
    ],
    [
      'an agent-only field on a user step',
      { steps: [step({ source: 'user', model_name: 'm' })] },
      /'model_name' is only applicable when source is 'agent'/,
    ],
    [
      'metrics on a step with no model call',
      { steps: [step({ llm_call_count: 0, metrics: {} })] },
      /'metrics' must be absent when llm_call_count is 0/,
    ],
    ['a timestamp that is not ISO 8601', { steps: [step({ timestamp: 'yesterday' })] }, /ISO 8601/],
    ['a day the month lacks', { steps: [step({ timestamp: '2026-02-30T00:00:00Z' })] }, /ISO 8601/],
    [
      'a text part with a source',
      {
        steps: [
          step({
            message: [{ type: 'text', text: 't', source: { media_type: 'image/png', path: 'p' } }],
          }),
        ],
      },
      /'source' field is not allowed when type='text'/,
    ],
    ['an unknown version', { schema_version: 'ATIF-v2.0' }, /schema_version/],
  ]
  for (const [what, t, message] of refusals) {
    test(`refuses ${what}`, () => {
      const parsed = trajectorySchema.safeParse(doc(t))
      assert.ok(!parsed.success)
      assert.match(JSON.stringify(parsed.error.issues), message)
    })
  }

  test('takes an audio alias and a minimal document', () => {
    assert.ok(trajectorySchema.safeParse(doc({})).success)
    const audio = { type: 'audio', source: { media_type: 'audio/mp3', path: 'a.mp3' } }
    assert.ok(trajectorySchema.safeParse(doc({ steps: [step({ message: [audio] })] })).success)
    for (const timestamp of ['2024-02-29', '2026-01-01 10:00+05', '2026-01-01T10:00:00.5+0530']) {
      assert.ok(
        trajectorySchema.safeParse(doc({ steps: [step({ timestamp })] })).success,
        timestamp,
      )
    }
  })
})

describe('exports in the config', () => {
  test("writes each attempt's atif.json beside its trajectory, kept in the history", async () => {
    const p = await project('config-exports', {
      'reeval.config.ts': fakeConfig({
        extra: "exports: ['atif'], record: 'always', history: { artifacts: 'all' },",
      }),
      'evals/hello.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('go')
  },
})
`,
    })
    const run = await runCli(p.dir)
    assert.equal(run.code, 0, run.stderr)
    const history = join(p.dir, HISTORY_DIR)
    const [file] = readdirSync(history).filter((f) => f.endsWith('.json'))
    const record = JSON.parse(readFileSync(join(history, file as string), 'utf8')) as RunRecord
    const [attempt] = record.evals.flatMap((e) => e.attempts)
    const ref = attempt?.files.atif
    assert.equal(
      ref?.path,
      attempt?.files.trajectory?.path.replace('trajectory.jsonl', 'atif.json'),
    )
    const trajectory = JSON.parse(readFileSync(join(history, record.runId, ref.path), 'utf8'))
    const parsed = trajectorySchema.safeParse(trajectory)
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues, null, 2))
    assert.equal(parsed.data.session_id, record.runId)

    // At the default `evidence` level a passing attempt keeps neither its trajectory nor its export.
    writeFileSync(
      join(p.dir, 'reeval.config.ts'),
      fakeConfig({ extra: "exports: ['atif'], record: 'always'," }),
    )
    const pruned = await runCli(p.dir)
    assert.equal(pruned.code, 0, pruned.stderr)
    const runs = readdirSync(history).filter((f) => f.endsWith('.json') && f !== file)
    const [kept] = (
      JSON.parse(readFileSync(join(history, runs[0] as string), 'utf8')) as RunRecord
    ).evals.flatMap((e) => e.attempts)
    assert.deepEqual([kept?.files.trajectory, kept?.files.atif], [undefined, undefined])
  })
})

describe('reeval export', () => {
  test("writes the run's archive, or an ATIF trajectory per attempt", async () => {
    const p = await project('export', { 'reeval.config.ts': fakeConfig() })
    cpSync(join(CORPUS_DIR, 'real-harnesses', HISTORY_DIR), join(p.dir, HISTORY_DIR), {
      recursive: true,
    })
    const [x] = exports('real-harnesses')
    const { runId } = x as { runId: string }

    const zip = await runCli(p.dir, ['export', runId])
    assert.equal(zip.code, 0, zip.stderr)
    const archive = await openArchive(join(p.dir, `${runId}.zip`))
    await archive.verify()
    assert.ok(archive.has(`${runId}.json`))
    await archive.close()

    const atif = await runCli(p.dir, ['export', runId, '--format', 'atif', '--out', 'out'])
    assert.equal(atif.code, 0, atif.stderr)
    assert.match(atif.stdout, /Wrote 7 atif\.json to out/)
    for (const e of exports('real-harnesses')) {
      const file = join(p.dir, 'out', dirname(e.path), 'atif.json')
      assert.equal(readFileSync(file, 'utf8'), e.text)
    }

    const bad = await runCli(p.dir, ['export', runId, '--format', 'nope'])
    assert.equal(bad.code, 2)
    assert.match(bad.stderr, /no format "nope": use atif/)
    assert.ok(!existsSync(join(p.dir, `${runId}.nope`)))
    const inherited = await runCli(p.dir, ['export', runId, '--format', 'constructor'])
    assert.equal(inherited.code, 2)

    mkdirSync(join(p.dir, 'zips'))
    const inDir = await runCli(p.dir, ['export', runId, '--out', 'zips'])
    assert.equal(inDir.code, 0, inDir.stderr)
    assert.ok(existsSync(join(p.dir, 'zips', `${runId}.zip`)))

    for (const e of exports('real-harnesses')) {
      rmSync(join(p.dir, HISTORY_DIR, runId, e.path))
    }
    const none = await runCli(p.dir, ['export', runId, '--format', 'atif', '--out', 'none'])
    assert.equal(none.code, 2)
    assert.match(none.stderr, /kept no trajectory for any attempt/)
  })
})
