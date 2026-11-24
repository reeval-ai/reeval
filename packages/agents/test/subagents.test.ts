// Subagents: what each harness's spawn calls say about them, Claude Code's stored usage read back
// by running its script on a store laid out as Claude Code writes it, and a turn's totals.
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import {
  antigravitySpawns,
  claudeSpawns,
  claudeStoredSubagentsCommand,
  codexSpawns,
  opencodeSpawns,
  parseClaudeStoredSubagents,
  toolSpawns,
} from '../src/catalog/subagents.ts'
import { turnSubagents, turnTotals } from '../src/driver/subagents.ts'
import { normalizeStream } from '../src/driver/transcript.ts'
import type { SubagentRun, TokenUsage, TranscriptEvent } from '../src/types.ts'

const at = { ts: '2026-11-24T10:45:11.000Z', atMs: 0 }
const tool = (
  toolCallId: string,
  name: string,
  input: unknown,
  output: unknown,
  ok: boolean | null = true,
): TranscriptEvent => ({
  ...at,
  type: 'tool',
  toolCallId,
  tool: name,
  input,
  output,
  outputView: 'model',
  ok,
  durationMs: 26,
})
const usage = (input: number, output: number): TokenUsage => ({
  input,
  output,
  cacheRead: 0,
  cacheWrite: 0,
  reasoning: 0,
})

describe('spawn calls', () => {
  test("Claude Code: a foreground Agent call's result, a background one's notification", () => {
    const events = [
      tool(
        'toolu_1',
        'Agent',
        { prompt: 'write add.js', subagent_type: 'general-purpose' },
        {
          agentId: 'a1',
          agentType: 'general-purpose',
          resolvedModel: 'claude-sonnet-5',
          status: 'completed',
          totalDurationMs: 4100,
          content: [{ type: 'text', text: 'Wrote add.js' }],
        },
      ),
      tool(
        'toolu_2',
        'Agent',
        { prompt: 'write mul.js', run_in_background: true },
        { isAsync: true, status: 'async_launched', agentId: 'a2' },
      ),
      tool(
        'toolu_3',
        'Agent',
        { prompt: 'never told', run_in_background: true },
        { isAsync: true, agentId: 'a3' },
      ),
    ]
    const raw = [
      {
        type: 'raw',
        rawValue: {
          type: 'system',
          subtype: 'task_notification',
          tool_use_id: 'toolu_2',
          status: 'completed',
          summary: 'Wrote mul.js',
          usage: { duration_ms: 5200, total_tokens: 900 },
        },
      },
    ]
    assert.deepEqual(claudeSpawns(events, raw), [
      {
        id: 'toolu_1',
        nativeId: 'a1',
        agent: 'general-purpose',
        model: 'claude-sonnet-5',
        prompt: 'write add.js',
        status: 'completed',
        durationMs: 4100,
        finalMessage: 'Wrote add.js',
      },
      {
        id: 'toolu_2',
        nativeId: 'a2',
        prompt: 'write mul.js',
        status: 'completed',
        durationMs: 5200,
        background: true,
        finalMessage: 'Wrote mul.js',
      },
      {
        id: 'toolu_3',
        nativeId: 'a3',
        prompt: 'never told',
        status: null,
        durationMs: null,
        background: true,
      },
    ])
  })

  test('Codex: the thread a spawn_agent call started, and how its last wait says it ended', () => {
    const thread = '01a20d29-ea24-7a00-9dd1-afe57f39bc22'
    const events = [
      tool(
        'c1',
        'spawn_agent',
        { prompt: 'write add.js', receiver_thread_ids: [] },
        {
          [thread]: { status: 'pending_init', message: null },
        },
      ),
      tool(
        'c2',
        'wait',
        { receiver_thread_ids: [thread] },
        {
          [thread]: { status: 'completed', message: 'Created src/add.js' },
        },
      ),
    ]
    assert.deepEqual(codexSpawns(events), [
      {
        id: 'c1',
        nativeId: thread,
        prompt: 'write add.js',
        status: 'completed',
        durationMs: null,
        finalMessage: 'Created src/add.js',
      },
    ])
  })

  test('Antigravity: each subagent an invoke_subagent call lists, still running', () => {
    const events = [
      tool(
        'g1',
        'invoke_subagent',
        {
          subagents: [
            { agent: 'self', prompt: 'write add.js' },
            { agent: 'self', prompt: 'write mul.js' },
          ],
        },
        '',
      ),
    ]
    assert.deepEqual(
      antigravitySpawns(events).map((s) => [s.id, s.prompt, s.status, s.background]),
      [
        ['g1#1', 'write add.js', null, true],
        ['g1#2', 'write mul.js', null, true],
      ],
    )
  })

  test("OpenCode: the child session and state in a subagent call's metadata", () => {
    const events = [
      tool(
        'o1',
        'subagent',
        { agent: 'general', prompt: 'write add.js' },
        {
          metadata: { sessionID: 'ses_1', status: 'completed' },
          output: '<subagent>5</subagent>',
        },
      ),
    ]
    assert.deepEqual(opencodeSpawns(events), [
      {
        id: 'o1',
        nativeId: 'ses_1',
        agent: 'general',
        prompt: 'write add.js',
        status: 'completed',
        durationMs: 26,
        finalMessage: '<subagent>5</subagent>',
      },
    ])
  })

  test("a background spawn tool says nothing of how its subagent ends; an ACP result's text", () => {
    const delegated = [tool('d1', 'delegate', { instructions: 'write add.js' }, 'Delegated')]
    assert.deepEqual(toolSpawns(['delegate'], true)(delegated, []), [
      {
        id: 'd1',
        prompt: 'write add.js',
        status: null,
        durationMs: null,
        background: true,
        finalMessage: 'Delegated',
      },
    ])
    const fx = [
      tool('f1', 'subagent', { task: 'write add.js' }, [
        { type: 'content', content: { type: 'text', text: 'done' } },
      ]),
    ]
    assert.deepEqual(toolSpawns(['subagent'])(fx, [])[0]?.finalMessage, 'done')
  })
})

test("a Claude Code subagent's text and thinking, tagged with its spawn call and untimed", () => {
  const events = normalizeStream(
    [
      {
        ms: 5,
        part: {
          type: 'raw',
          rawValue: {
            type: 'assistant',
            parent_tool_use_id: 'toolu_1',
            message: {
              content: [
                { type: 'thinking', thinking: 'Plan the file.' },
                { type: 'text', text: 'Wrote add.js.' },
                { type: 'text', text: '  ' },
              ],
            },
          },
        },
      },
    ],
    0,
  )
  assert.deepEqual(
    events.map((e) => [
      e.type,
      'text' in e ? e.text : '',
      'durationMs' in e ? e.durationMs : '',
      'subagent' in e ? e.subagent : '',
    ]),
    [
      ['reasoning', 'Plan the file.', null, 'toolu_1'],
      ['text', 'Wrote add.js.', null, 'toolu_1'],
    ],
  )
})

describe("Claude Code's stored subagent usage", () => {
  test("each subagent's own transcript, a message stored once per block counted once", () => {
    const home = mkdtempSync(join(tmpdir(), 'claude-subagents-'))
    try {
      const dir = join(home, 'projects', '-reeval-workspace', 'session-1', 'subagents')
      mkdirSync(dir, { recursive: true })
      const message = (id: string, output: number, thinking = 0) =>
        JSON.stringify({
          type: 'assistant',
          timestamp: '2026-11-24T10:45:20.000Z',
          message: {
            id,
            model: 'claude-sonnet-5',
            usage: {
              input_tokens: 3,
              cache_read_input_tokens: 1000,
              cache_creation_input_tokens: 200,
              output_tokens: output,
              ...(thinking ? { output_tokens_details: { thinking_tokens: thinking } } : {}),
            },
          },
        })
      writeFileSync(
        join(dir, 'agent-a1.jsonl'),
        [
          JSON.stringify({ type: 'user', timestamp: '2026-11-24T10:45:15.000Z' }),
          message('msg_1', 17),
          message('msg_1', 40, 12),
          message('msg_2', 105),
        ].join('\n'),
      )
      writeFileSync(join(dir, 'agent-other.jsonl'), message('msg_9', 1))
      const stdout = execSync(claudeStoredSubagentsCommand(['a1', 'gone']), {
        env: { ...process.env, CLAUDE_CONFIG_DIR: home },
        encoding: 'utf8',
      })
      assert.deepEqual(parseClaudeStoredSubagents(stdout), {
        a1: {
          usage: {
            inputTokens: { total: 2406, noCache: 6, cacheRead: 2000, cacheWrite: 400 },
            outputTokens: { total: 145, text: undefined, reasoning: 12 },
          },
          model: 'claude-sonnet-5',
          startedAt: Date.parse('2026-11-24T10:45:15.000Z'),
          endedAt: Date.parse('2026-11-24T10:45:20.000Z'),
        },
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test('twin: output that is not the JSON it prints reads as nothing stored', () => {
    assert.deepEqual(parseClaudeStoredSubagents('node: not found'), {})
  })
})

describe('a turn and its subagents', () => {
  const run = (over: Partial<SubagentRun> = {}): SubagentRun => ({
    id: 'toolu_1',
    prompt: 'p',
    status: 'completed',
    durationMs: 10,
    events: 'streamed',
    usage: usage(40, 4),
    ...over,
  })

  test("separate: the agent's own usage plus each subagent's", () => {
    assert.deepEqual(
      turnTotals('separate', usage(100, 10), [run(), run({ usage: usage(20, 2) })], false),
      {
        usage: usage(160, 16),
        agentUsage: usage(100, 10),
        subagentUsage: 'counted',
      },
    )
  })

  test('separate: a subagent whose usage is unknown, or still running, makes the total a lower bound', () => {
    assert.equal(
      turnTotals('separate', usage(100, 10), [run({ usage: null })], false).subagentUsage,
      'missing',
    )
    assert.equal(
      turnTotals('separate', usage(100, 10), [run({ status: null })], false).subagentUsage,
      'missing',
    )
  })

  test("included: the total as reported, the agent's share when every subagent's is known", () => {
    assert.deepEqual(turnTotals('included', usage(160, 16), [run()], false), {
      usage: usage(160, 16),
      agentUsage: usage(120, 12),
      subagentUsage: 'counted',
    })
    assert.deepEqual(turnTotals('included', usage(160, 16), [run({ usage: null })], false), {
      usage: usage(160, 16),
      agentUsage: null,
      subagentUsage: 'counted',
    })
  })

  test("unknown, or usage read back from the store, isn't split or added to", () => {
    for (const [mode, fromStore] of [
      ['unknown', false],
      ['separate', true],
    ] as const) {
      assert.deepEqual(turnTotals(mode, usage(100, 10), [run()], fromStore), {
        usage: usage(100, 10),
        agentUsage: null,
        subagentUsage: 'unknown',
      })
    }
  })

  test("a subagent's stored usage and model by its native id; its parent from its spawn's tag", async () => {
    const events = [
      tool('toolu_1', 'Agent', { prompt: 'outer' }, { agentId: 'a1' }),
      { ...tool('toolu_2', 'Agent', { prompt: 'inner' }, { agentId: 'a2' }), subagent: 'toolu_1' },
    ] as TranscriptEvent[]
    const asked: string[] = []
    const runs = await turnSubagents(
      {
        events: 'streamed',
        usage: 'separate',
        spawns: claudeSpawns,
        stored: async () => ({
          command: (ids) => ids.join(' '),
          parse: () => ({
            a1: {
              usage: {
                inputTokens: { total: 50, noCache: 50, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 5, text: undefined, reasoning: 0 },
              },
              model: 'claude-haiku-5',
              startedAt: 1000,
              endedAt: 4000,
            },
          }),
        }),
      },
      events,
      [],
      async (command) => {
        asked.push(command)
        return '{}'
      },
    )
    assert.deepEqual(asked, ['a1 a2'])
    assert.deepEqual(
      runs.map((r) => [r.id, r.parent, r.model, r.durationMs, r.usage?.input ?? null]),
      [
        ['toolu_1', undefined, 'claude-haiku-5', 3000, 50],
        ['toolu_2', 'toolu_1', undefined, null, null],
      ],
    )
  })
})
