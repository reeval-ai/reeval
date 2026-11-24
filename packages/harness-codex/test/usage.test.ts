import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  codexStoredSubagentsCommand,
  codexStoredUsageCommand,
  parseCodexStoredSubagents,
  parseCodexStoredUsage,
} from '../src/codex-usage.ts'

const run = (home: string, since: number) =>
  spawnSync('sh', ['-c', codexStoredUsageCommand({ since })], {
    env: { ...process.env, HOME: home },
    encoding: 'utf8',
  })

// The token_count events of a captured Codex 0.164 rollout: 11 calls, and one with no counts.
const home = mkdtempSync(join(tmpdir(), 'codex-usage-'))
const day = join(home, '.codex/sessions/2026/11/05')
mkdirSync(day, { recursive: true })
copyFileSync(
  join(import.meta.dirname, 'fixtures/rollout-token-counts.jsonl'),
  join(day, 'rollout-2026-11-05T17-39-17-01a1accb.jsonl'),
)

test("the stored usage sums each model call's counts in the rollout since the turn began", () => {
  const out = run(home, Date.parse('2026-11-05T17:39:43.000Z'))
  assert.equal(out.status, 0, out.stderr)
  assert.deepEqual(parseCodexStoredUsage(out.stdout), {
    calls: 5,
    usage: {
      inputTokens: { total: 116_749, noCache: 15, cacheRead: 101_399, cacheWrite: 15_335 },
      outputTokens: { total: 338, text: 218, reasoning: 120 },
    },
  })
})

test('the stored usage of every call equals the total Codex keeps for the thread', () => {
  const read = parseCodexStoredUsage(run(home, 0).stdout)
  assert.equal(read?.calls, 11)
  assert.equal(read?.usage.inputTokens.total, 186_895)
  assert.equal(read?.usage.outputTokens.total, 953)
})

test('no calls since the turn began, or no rollouts, is no stored usage', () => {
  assert.equal(parseCodexStoredUsage(run(home, Date.parse('2026-11-06')).stdout), undefined)
  const empty = run(mkdtempSync(join(tmpdir(), 'codex-usage-')), 0)
  assert.equal(empty.status, 0, empty.stderr)
  assert.equal(parseCodexStoredUsage(empty.stdout), undefined)
  assert.equal(parseCodexStoredUsage('not json'), undefined)
})

test("a sub-agent thread's usage is the last total in its own rollout, with its model", () => {
  const thread = '01a20d29-ea24-7a00-9dd1-afe57f39bc22'
  const line = (timestamp: string, type: string, payload: object) =>
    JSON.stringify({ timestamp, type, payload })
  const total = (input: number, cached: number, output: number) => ({
    type: 'token_count',
    info: {
      total_token_usage: {
        input_tokens: input,
        cached_input_tokens: cached,
        output_tokens: output,
        reasoning_output_tokens: 60,
      },
    },
  })
  const sub = mkdtempSync(join(tmpdir(), 'codex-subagents-'))
  const dir = join(sub, '.codex/sessions/2026/11/24')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, `rollout-2026-11-24T10-46-20-${thread}.jsonl`),
    [
      line('2026-11-24T10:46:20.000Z', 'session_meta', { id: thread, parent_thread_id: 'p' }),
      line('2026-11-24T10:46:21.000Z', 'turn_context', { model: 'gpt-5.6-luna' }),
      line('2026-11-24T10:46:25.000Z', 'event_msg', total(20_000, 19_000, 100)),
      line('2026-11-24T10:46:31.000Z', 'event_msg', total(42_519, 41_961, 326)),
    ].join('\n'),
  )
  const out = spawnSync('sh', ['-c', codexStoredSubagentsCommand([thread, 'gone'])], {
    env: { ...process.env, HOME: sub },
    encoding: 'utf8',
  })
  assert.equal(out.status, 0, out.stderr)
  const found = parseCodexStoredSubagents(out.stdout)
  assert.deepEqual(Object.keys(found), [thread])
  assert.equal(found[thread]?.model, 'gpt-5.6-luna')
  assert.equal((found[thread]?.endedAt ?? 0) - (found[thread]?.startedAt ?? 0), 11_000)
  assert.equal(found[thread]?.usage.inputTokens.total, 42_519)
  assert.equal(found[thread]?.usage.inputTokens.cacheRead, 41_961)
  assert.equal(found[thread]?.usage.outputTokens.total, 326)
})
