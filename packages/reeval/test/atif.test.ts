// ATIF export: `toAtif` on real runs from the record corpus against goldens in
// test/fixtures/atif/, each held to the Zod port of Harbor's trajectory validator (drift.yml holds
// the same goldens to Harbor's own), the port's refusals, and `reeval export` end to end.
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, test } from 'node:test'
import { openArchive } from '../src/archive/index.ts'
import type { RunRecord } from '../src/history/types.ts'
import { toAtif } from '../src/view/atif.ts'
import { trajectorySchema } from '../src/view/atif-schema.ts'
import { parseTranscript } from '../src/view/model.ts'
import { readableRecord } from '../src/view/record.ts'
import { fakeConfig, project, runCli } from './helpers.ts'
import { CORPUS_DIR, HISTORY_DIR } from './support/corpus.ts'

const GOLDEN_DIR = join(import.meta.dirname, 'fixtures/atif')
const ENTRIES = ['real-harnesses', 'before-subagents']
const update = process.env.REEVAL_UPDATE_SNAPSHOTS === '1'

/** Each attempt with a transcript in an entry's runs, with its golden's path and its export. */
function exports(entry: string) {
  const history = join(CORPUS_DIR, entry, HISTORY_DIR)
  return readdirSync(history)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const run = readableRecord(JSON.parse(readFileSync(join(history, f), 'utf8')) as RunRecord)
      return run.evals.flatMap((e) =>
        e.attempts.flatMap((a) => {
          const path = a.files.transcript?.path
          if (!path) return []
          const lines = parseTranscript(readFileSync(join(history, run.runId, path), 'utf8'))
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
  })
})
