// The core harness contract: each real harness's CLI, installed by `start()` on a bare Node image
// under docker(), with its key in the CLI's environment, does what reeval's contract checks of it
// that needs no gateway: it reads a placed skill and its rules, calls a stdio MCP server, edits a
// file and runs a command as those kinds of tool, reports its tokens and model, and leaves no
// container behind. reeval's test/contract.test.ts keeps what only its gateway sees (the key
// absent, deny-all, the served model off the wire) and the native stream formats.
//
// Real tier: REEVAL_TEST_REAL=1, each row's key, and Docker. REEVAL_CONTRACT_HARNESSES (reeval's
// contract's row list) narrows the rows; a row it names without its key fails, naming the variable.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { HarnessV1 } from '@ai-sdk/harness'
import { docker } from '../src/docker/index.ts'
import type { HarnessResult } from '../src/driver/types.ts'
import { catalogAdapter, type HarnessSpec } from '../src/harnesses.ts'
import type { Runner } from '../src/runner.ts'
import { type AgentSession, agent } from '../src/session.ts'
import type { TranscriptEvent } from '../src/types.ts'

/** Node's own image, with curl and bash, which the CLIs' installs download and run with. */
const IMAGE = 'node:24'
/** Where the harnesses that serve their bridge over a port listen; docker() publishes it. */
const BRIDGE_PORT = 24210

type Row = {
  id: string
  harness: HarnessSpec['kind']
  model: string
  /** The variable the adapter reads, and the host variables it's taken from, in order. */
  key: { name: string; from: string[] }
  /** What every turn's `model` looks like; null for a harness that names none, so it must be null. */
  servedModel: RegExp | null
}

const ROWS: Row[] = [
  {
    id: 'cursor',
    model: 'composer-2.5',
    harness: 'cursor',
    key: { name: 'CURSOR_API_KEY', from: ['CURSOR_API_KEY'] },
    servedModel: /^composer-2\.5/,
  },
  {
    id: 'antigravity',
    harness: 'antigravity',
    model: 'gemini-3.8-flash-low',
    key: { name: 'GEMINI_API_KEY', from: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'] },
    servedModel: /^gemini-3\.8-flash/,
  },
  {
    id: 'claude-code',
    harness: 'claude-code',
    model: 'claude-haiku-5-5',
    key: { name: 'ANTHROPIC_API_KEY', from: ['ANTHROPIC_API_KEY'] },
    servedModel: /^claude-haiku-5-5/,
  },
  {
    id: 'opencode',
    harness: 'opencode',
    model: 'google/gemini-3.8-flash',
    key: {
      name: 'GOOGLE_GENERATIVE_AI_API_KEY',
      from: ['GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
    },
    servedModel: null,
  },
  {
    id: 'goose',
    harness: 'goose',
    model: 'google/gemini-3.8-flash',
    key: {
      name: 'GOOGLE_API_KEY',
      from: ['GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
    },
    servedModel: null,
  },
  {
    id: 'pi',
    harness: 'pi',
    model: 'google/gemini-3.8-flash',
    key: {
      name: 'GEMINI_API_KEY',
      from: ['GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
    },
    servedModel: /^gemini-3\.8-flash$/,
  },
  {
    id: 'codex',
    harness: 'codex',
    model: 'gpt-5.6-luna',
    key: { name: 'OPENAI_API_KEY', from: ['OPENAI_API_KEY'] },
    servedModel: null,
  },
  {
    id: 'fx',
    harness: 'fx',
    model: 'gpt-5.5',
    key: { name: 'OPENAI_API_KEY', from: ['OPENAI_API_KEY'] },
    servedModel: null,
  },
  {
    id: 'grok-build',
    harness: 'grok-build',
    model: 'grok-4.6',
    key: { name: 'XAI_API_KEY', from: ['XAI_API_KEY'] },
    servedModel: null,
  },
]

const SKILL_PROOF = 'PROBE-7F3K-QUILL'
const RULES_WORD = 'TANGERINE-41'
const COMMAND = 'echo contract-$((6*7))'
const COMMAND_OUTPUT = 'contract-42'
const MCP_LOG = '/tmp/reeval-mcp-stamp.log'
const STAMP_PATH = '/opt/reeval-contract/stamp.mjs'

const SKILL = {
  name: 'contract-probe',
  description:
    'Runs the contract probe. Use when asked to use the contract-probe skill or to run the contract probe.',
  content: `# Contract probe\n\nCreate a file named \`skill-proof.txt\` in the workspace root (the current directory) containing\nexactly this line, and nothing else:\n\n${SKILL_PROOF}\n\nThen reply with the single word DONE.\n`,
}
const RULES = `# House rules\n\nThe house codeword is ${RULES_WORD}. When anyone asks for the house codeword, write it (the codeword only) into a file named codeword.txt in the workspace root.\n`

const PROMPTS = {
  skill:
    'Use your contract-probe skill: do exactly what it says, then stop. Keep your reply short.',
  rules: 'What is the house codeword? Follow your house rules for it, then stop.',
  mcp: 'Call the house_stamp tool of the stamp MCP server once, then reply with what it returned.',
  editAndRun: `In notes.txt, change the word draft to final with your file editing tool. Then run this exact shell command once: ${COMMAND}. Then stop.`,
}

const real = process.env.REEVAL_TEST_REAL === '1'
const named = process.env.REEVAL_CONTRACT_HARNESSES?.split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const rows = named ? ROWS.filter((r) => named.includes(r.id)) : ROWS

function dockerSkip(): string | false {
  if (!real) return 'REEVAL_TEST_REAL=1 runs the real-agent contract'
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore', timeout: 10_000 })
  } catch {
    throw new Error('REEVAL_TEST_REAL=1, but Docker is not running')
  }
  try {
    execFileSync('docker', ['image', 'inspect', IMAGE], { stdio: 'ignore' })
  } catch {
    execFileSync('docker', ['pull', '--quiet', IMAGE], { stdio: 'ignore', timeout: 300_000 })
  }
  return false
}
const skip = dockerSkip()

const TURNS = Object.keys(PROMPTS).length

/**
 * Reserves the row's turns in the CI job's ledger of real attempts (`REEVAL_REAL_LEDGER`, one
 * number per line), failing before anything starts when they'd take the job over
 * `REEVAL_REAL_ATTEMPT_BUDGET`. Unset, no cap.
 */
function reserve(row: Row): void {
  const budget = Number(process.env.REEVAL_REAL_ATTEMPT_BUDGET)
  const ledger = process.env.REEVAL_REAL_LEDGER
  if (!budget || !ledger) return
  const spent = existsSync(ledger)
    ? readFileSync(ledger, 'utf8')
        .split('\n')
        .filter(Boolean)
        .reduce((sum, line) => sum + Number(line.split(' ')[0]), 0)
    : 0
  if (spent + TURNS > budget) {
    throw new Error(
      `the core contract on ${row.id} would start ${TURNS} real turns, over the job's budget of ${budget} (${spent} reserved): raise contract.yml's REEVAL_REAL_ATTEMPT_BUDGET if the suite grew on purpose`,
    )
  }
  appendFileSync(ledger, `${TURNS} core contract ${row.id}\n`)
}

const text = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v ?? ''))
const tools = (events: readonly TranscriptEvent[]) =>
  events.flatMap((e) => (e.type === 'tool' ? [e] : []))
const describeTools = (events: readonly TranscriptEvent[]) =>
  events
    .flatMap((e) =>
      e.type === 'tool'
        ? [`${e.tool}: ${text(e.input).slice(0, 200)} → ${text(e.output).slice(0, 200)}`]
        : e.type === 'file-edit'
          ? [`file-edit ${e.kind} ${e.path}`]
          : e.type === 'error'
            ? [`error: ${e.message}`]
            : [],
    )
    .join('\n')

type ToolKind = 'readonly' | 'edit' | 'bash'

/** Each catalog tool's kind, by its name in the transcript, from the adapter the session builds. */
async function catalogOf(row: Row): Promise<Map<string, ToolKind | undefined>> {
  const adapter: HarnessV1 = await catalogAdapter({
    auth: { [row.key.name]: 'probe' },
    model: row.model,
    harness: { kind: row.harness, model: row.model } as HarnessSpec,
    route: { kind: 'direct' },
    plugins: [],
    env: process.env,
  })
  const builtins = (adapter.builtinTools ?? {}) as Record<string, { toolUseKind?: ToolKind }>
  return new Map(Object.entries(builtins).map(([name, t]) => [name, t.toolUseKind]))
}

for (const row of rows) {
  test(row.id, { skip, timeout: 25 * 60_000 }, async (t) => {
    const key = row.key.from.map((v) => process.env[v]).find(Boolean)
    assert.ok(
      key,
      `${row.key.from.join(' or ')} isn't set, and REEVAL_TEST_REAL=1 asks for real ${row.id}: set it, or leave ${row.id} out of REEVAL_CONTRACT_HARNESSES`,
    )
    reserve(row)
    const name = `reeval-agents-contract-${row.id}-${process.pid}`
    let box: Runner | undefined
    const read = async (path: string) => {
      const bytes = await box?.readFile(path)
      return bytes ? new TextDecoder().decode(bytes).trim() : null
    }
    const turns: Array<{ name: string; result: HarnessResult }> = []
    let session: AgentSession | undefined
    t.after(() => box?.close())
    try {
      session = await agent({
        harness: { kind: row.harness, model: row.model } as HarnessSpec,
        // The session's own runner, so closing the session must remove its container.
        runner: async () => {
          box = await docker({ image: IMAGE, name, ports: [BRIDGE_PORT] })
          await box.writeFile(
            STAMP_PATH,
            readFileSync(new URL('contract/stamp.mjs', import.meta.url)),
          )
          await box.writeFile('notes.txt', 'status: draft\n')
          return box
        },
        session: { ports: [BRIDGE_PORT] },
        credentials: { [row.key.name]: key },
        install: 'auto',
        rules: RULES,
        skills: [SKILL],
        mcp: { stamp: { transport: 'stdio', command: 'node', args: [STAMP_PATH], env: {} } },
        onEvent: (e) => {
          if (e.type === 'phase') t.diagnostic(`${e.phase}: ${e.ms} ms`)
          if (e.type === 'warning') t.diagnostic(`warning: ${e.message}`)
        },
      }).start()
      const live = session
      const send = async (turn: string, prompt: string) => {
        const result = await live.send(prompt).result
        turns.push({ name: turn, result })
        assert.equal(
          result.status,
          'completed',
          `${turn}: the turn ended ${result.status}\n${describeTools(result.transcript)}`,
        )
        return result
      }

      await t.test('placed skill read', async () => {
        const result = await send('skill', PROMPTS.skill)
        assert.equal(await read('skill-proof.txt'), SKILL_PROOF, describeTools(result.transcript))
      })

      await t.test('rules read', async () => {
        const result = await send('rules', PROMPTS.rules)
        assert.equal(await read('codeword.txt'), RULES_WORD, describeTools(result.transcript))
      })

      await t.test('stdio MCP server called', async () => {
        const result = await send('mcp', PROMPTS.mcp)
        assert.match((await read(MCP_LOG)) ?? '', /tools\/call/, describeTools(result.transcript))
        assert.ok(
          tools(result.transcript).some((e) => e.tool === 'mcp__stamp__house_stamp'),
          `no mcp__stamp__house_stamp call:\n${describeTools(result.transcript)}`,
        )
      })

      await t.test('file edited and command run, as those kinds', async () => {
        const result = await send('edit and run', PROMPTS.editAndRun)
        const catalog = await catalogOf(row)
        const events = result.transcript
        const how = describeTools(events)
        assert.equal(await read('notes.txt'), 'status: final', how)
        const kindOf = (tool: string) => catalog.get(tool)
        assert.ok(
          events.some((e) => e.type === 'file-edit' && e.path === 'notes.txt') ||
            tools(events).some(
              (e) => text(e.input).includes('notes.txt') && kindOf(e.tool) === 'bash',
            ),
          `the edit of notes.txt isn't a file edit or a command:\n${how}`,
        )
        assert.ok(
          tools(events).some(
            (e) => text(e.output).includes(COMMAND_OUTPUT) && kindOf(e.tool) === 'bash',
          ),
          `no command tool printed ${COMMAND_OUTPUT}:\n${how}`,
        )
      })

      await t.test("every tool call in the adapter's catalog", async () => {
        const catalog = await catalogOf(row)
        const unknown = [
          ...new Set(
            turns.flatMap(({ result }) =>
              tools(result.transcript)
                .map((e) => e.tool)
                .filter((n) => !n.startsWith('mcp__') && !catalog.has(n)),
            ),
          ),
        ].sort()
        assert.deepEqual(
          unknown,
          [],
          `${row.id} called tools its adapter's catalog doesn't know, so they reach the transcript under their native names: ${unknown.join(', ')}`,
        )
      })

      await t.test('tokens and model reported on every turn', () => {
        assert.ok(turns.length > 0, 'no turns ran')
        for (const { name: turn, result } of turns) {
          assert.ok(result.usage, `${turn}: no token usage`)
          assert.ok(
            result.usage.input + result.usage.cacheRead > 0 && result.usage.output > 0,
            `${turn}: ${JSON.stringify(result.usage)}`,
          )
          if (row.servedModel) assert.match(result.model ?? '', row.servedModel, turn)
          else assert.equal(result.model, null, `${turn}: ${row.id} names a model now`)
        }
      })
    } finally {
      await session?.close()
    }

    await t.test('nothing left behind', () => {
      const left = execFileSync(
        'docker',
        ['ps', '-aq', '--filter', `name=^${name}$`, '--filter', 'label=ai.reeval.agents=docker'],
        { encoding: 'utf8' },
      ).trim()
      assert.equal(left, '', `${name} is still there after the session closed`)
    })
  })
}
