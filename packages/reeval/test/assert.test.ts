// The evidence the built-in graders read from a trajectory: skill, tool, MCP and shell calls,
// edits, the diff, web events and budgets, every replay capture through today's normalizer, and
// each harness's captured skill use.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { SKILL_DIRS } from '@reeval/agents/layouts'
import {
  budgetUsed,
  changesIn,
  commandsRun,
  editedPaths,
  limitsProblem,
  mcpCalls,
  overLimits,
  runMatchLabel,
  skillCalls,
  toolCalls as toolCallsIn,
  webEvents,
} from '../src/assert.ts'
import { AGENTS, type AgentKind } from '../src/harness/agents.ts'
import { normalizeStream } from '../src/harness/trajectory.ts'
import { classifyCall, skillsUsed } from '../src/history/tool-class.ts'
import { toolTarget } from '../src/history/tool-target.ts'
import type { TrajectoryEvent } from '../src/types.ts'
import { toolCalls } from '../src/view/classify.ts'
import { trajectoryByLine } from '../src/view/model.ts'
import { testDir } from './support/fixture.ts'

const at = { ts: '2026-10-05T12:00:00.000Z', atMs: 0, durationMs: 1 }

const tool = (
  name: string,
  input: unknown,
  output: unknown = 'ok',
): Extract<TrajectoryEvent, { type: 'tool' }> => ({
  ...at,
  type: 'tool',
  toolCallId: `call_${name}`,
  tool: name,
  input,
  output,
  ok: true,
})

const edit = (
  path: string,
  kind: 'create' | 'modify' | 'delete' = 'modify',
): Extract<TrajectoryEvent, { type: 'file-edit' }> => ({
  ...at,
  type: 'file-edit',
  toolCallId: `edit_${path}`,
  path,
  kind,
  added: 1,
  removed: 0,
})

const usedSkill = (trajectory: TrajectoryEvent[], name: string) =>
  skillCalls(trajectory, name).length > 0

const ranAny = (trajectory: TrajectoryEvent[], command?: Parameters<typeof commandsRun>[1]) =>
  commandsRun(trajectory, command).hits.length > 0

describe('skillCalls', () => {
  test('finds a dedicated load tool by id or name', () => {
    assert.equal(usedSkill([tool('skill', { id: 'foo' })], 'foo'), true)
    assert.equal(usedSkill([tool('Skill', { name: 'foo' })], 'foo'), true)
    assert.equal(usedSkill([tool('load_skill', { name: 'foo' })], 'foo'), true)
  })

  test('finds a tool whose target contains skills/<name>/', () => {
    const read = [tool('read', { path: '/home/reeval/.agents/skills/foo/SKILL.md' })]
    const sed = [tool('bash', { command: "sed -n '1,40p' ~/.agents/skills/foo/SKILL.md" })]
    assert.equal(usedSkill(read, 'foo'), true)
    assert.equal(usedSkill(sed, 'foo'), true)
  })

  test("doesn't count another skill's calls", () => {
    const t = [
      tool('skill', { id: 'house-greeting' }),
      tool('read', { path: '~/.agents/skills/other/SKILL.md' }),
      tool('bash', { command: 'echo hi' }),
    ]
    assert.equal(usedSkill(t, 'foo'), false)
    assert.equal(usedSkill(t, 'house-greeting'), true)
  })
})

describe('toolCalls', () => {
  test('matches type: tool only, by exact name or RegExp', () => {
    const t = [tool('mcp__stamp__house_stamp', { args: {} }), edit('notes.txt')]
    assert.equal(toolCallsIn(t, 'mcp__stamp__house_stamp').length, 1)
    assert.equal(toolCallsIn(t, /^mcp__stamp__/).length, 1)
    assert.equal(toolCallsIn(t, 'edit').length, 0)
    assert.equal(toolCallsIn(t, 'mcp__stamp__other').length, 0)
  })

  test('optional input is a substring, RegExp, or object', () => {
    const t = [tool('bash', { command: 'echo contract-42' })]
    assert.equal(toolCallsIn(t, 'bash', 'contract-42').length, 1)
    assert.equal(toolCallsIn(t, 'bash', /contract-\d+/).length, 1)
    assert.equal(toolCallsIn(t, 'bash', { command: 'echo contract-42' }).length, 1)
    assert.equal(toolCallsIn(t, 'bash', { command: /42/ }).length, 1)
    assert.equal(toolCallsIn(t, 'bash', 'deploy').length, 0)
  })
})

describe('mcpCalls', () => {
  test('joins server and tool into mcp__<server>__<tool>', () => {
    const t = [tool('mcp__stamp__house_stamp', { args: {} }), edit('notes.txt')]
    assert.equal(mcpCalls(t, 'stamp', 'house_stamp').length, 1)
    assert.equal(mcpCalls(t, 'stamp').length, 1)
    assert.equal(mcpCalls(t, 'stamp', 'other').length, 0)
    assert.equal(mcpCalls(t, 'other', 'house_stamp').length, 0)
  })

  test('optional input is the same match as toolCalls', () => {
    const t = [tool('mcp__stamp__house_stamp', { query: 'contract-42' })]
    assert.equal(mcpCalls(t, 'stamp', 'house_stamp', 'contract-42').length, 1)
    assert.equal(mcpCalls(t, 'stamp', 'house_stamp', /contract-\d+/).length, 1)
    assert.equal(mcpCalls(t, 'stamp', 'house_stamp', { query: 'contract-42' }).length, 1)
    assert.equal(mcpCalls(t, 'stamp', 'house_stamp', { query: /42/ }).length, 1)
    assert.equal(mcpCalls(t, 'stamp', 'house_stamp', 'deploy').length, 0)
  })
})

describe('commandsRun', () => {
  test('matches bash or shell, and an optional command', () => {
    const bash = [tool('bash', { command: 'echo contract-42' })]
    const shell = [tool('shell', { command: 'echo contract-42' })]
    const other = [tool('read', { path: 'notes.txt' })]
    assert.equal(ranAny(bash), true)
    assert.equal(ranAny(shell, /contract-42/), true)
    assert.equal(ranAny(bash, 'deploy'), false)
    assert.equal(ranAny(other), false)
  })

  test('a string or RegExp still matches the whole command line', () => {
    const t = [tool('bash', { command: 'cat genkit.config.ts' })]
    assert.equal(ranAny(t, 'genkit'), true)
    assert.equal(ranAny(t, /genkit/), true)
    assert.equal(ranAny(t, { program: 'genkit' }), false)
  })

  test('{ program } matches the program a segment ran, after its wrappers', () => {
    const t = [
      tool('bash', { command: 'cd app && FOO=1 npx -y genkit@latest flow:run x' }),
      tool('shell', { command: 'npm i genkit; ./node_modules/.bin/skills add y' }),
    ]
    assert.equal(ranAny(t, { program: 'genkit' }), true)
    assert.equal(ranAny(t, { program: 'genkit', args: /^flow:run\b/ }), true)
    assert.equal(ranAny(t, { program: 'genkit', args: 'flow:run x' }), true)
    assert.equal(ranAny(t, { program: /^gen/, args: 'x' }), true)
    assert.equal(ranAny(t, { program: 'skills', args: /^add\b/ }), true)
    assert.equal(ranAny(t, { program: 'genkit', args: /^start\b/ }), false)
    assert.equal(ranAny(t, { program: 'npx' }), false)
    assert.equal(ranAny(t, { program: 'npm', args: /^i\b/ }), true)
  })

  test('{ program } lists every program run, and the matching ones', () => {
    const t = [tool('bash', { command: 'npm i genkit && npx genkit start' })]
    assert.deepEqual(commandsRun(t, { program: 'genkit' }), {
      seen: ['npm i genkit', 'genkit start'],
      hits: ['genkit start'],
    })
  })

  test('{ program } is checked: its keys, its program and its args', () => {
    const t = [tool('bash', { command: 'genkit start' })]
    const refused = (match: unknown, message: RegExp) =>
      assert.throws(
        () => commandsRun(t, match as never),
        (e: Error) => e instanceof TypeError && message.test(e.message),
      )
    refused({ program: 'genkit', arg: 'start' }, /has no "arg"; .* Did you mean "args"\?/)
    refused({ args: 'start' }, /program is a program name or a regular expression/)
    refused({ program: '' }, /program is a program name/)
    refused({ program: 'genkit', args: ['start'] }, /args is text or a regular expression/)
  })

  test('runMatchLabel names the program and its args', () => {
    assert.equal(
      runMatchLabel({ program: 'genkit', args: /^flow:run\b/ }),
      'program genkit args /^flow:run\\b/',
    )
    assert.equal(runMatchLabel({ program: /gen/ }), 'program /gen/')
    assert.equal(runMatchLabel('genkit'), undefined)
    assert.equal(runMatchLabel(/genkit/), undefined)
  })
})

describe('editedPaths', () => {
  test('lists the file-edit paths once each, matching a path', () => {
    const t = [edit('notes.txt'), edit('notes.txt'), edit('a.txt', 'create')]
    assert.deepEqual(editedPaths(t), ['notes.txt', 'a.txt'])
    assert.deepEqual(editedPaths(t, /^a/), ['a.txt'])
  })

  test("doesn't count a tool that only names the path", () => {
    const heredoc = tool('bash', { command: "cat <<'EOF' > notes.txt\nhello\nEOF" }, '')
    assert.deepEqual(editedPaths([tool('bash', { command: 'cat notes.txt' }, 'hello')]), [])
    assert.deepEqual(editedPaths([heredoc], 'notes.txt'), [])
  })
})

describe('changesIn', () => {
  const files = [
    { path: 'test/greet.test.js', status: 'modified' as const },
    { path: 'src/greet.ts', status: 'added' as const },
  ]
  const paths = (match?: Parameters<typeof changesIn>[1]) =>
    changesIn(files, match).map((f) => f.path)

  test('matches the diff with globs, directories, RegExps and lists', () => {
    assert.deepEqual(paths('test/**'), ['test/greet.test.js'])
    assert.deepEqual(paths('test'), ['test/greet.test.js'])
    assert.deepEqual(paths('./test/'), ['test/greet.test.js'])
    assert.deepEqual(paths('src/greet.ts'), ['src/greet.ts'])
    assert.deepEqual(paths(/\.test\.js$/), ['test/greet.test.js'])
    assert.deepEqual(paths(['tsconfig.json', 'src/*.ts']), ['src/greet.ts'])
    assert.deepEqual(paths(), ['test/greet.test.js', 'src/greet.ts'])
    assert.deepEqual(paths('greet.ts'), [])
    assert.deepEqual(paths(['tsconfig.json', 'biome.json']), [])
    assert.deepEqual(changesIn([]), [])
  })
})

describe('webEvents', () => {
  const web: TrajectoryEvent[] = [
    {
      ...at,
      type: 'web-fetch',
      toolCallId: 'f',
      url: 'https://httpbin.org/ip',
      ok: true,
    },
    {
      ...at,
      type: 'web-search',
      toolCallId: 's',
      query: 'IANA example domain RFC 2606',
      references: 2,
    },
  ]

  test('lists the fetches and searches, and those matching', () => {
    const subject = { trajectory: web, unreported: [] }
    assert.deepEqual(webEvents(subject, 'web-fetch', 'httpbin.org', 'fetched()').hits, [
      'https://httpbin.org/ip',
    ])
    assert.deepEqual(webEvents(subject, 'web-search', /RFC 2606/, 'searched()').hits, [
      'IANA example domain RFC 2606',
    ])
  })

  test("refuse a turn whose harness doesn't report them", () => {
    const cursor = { trajectory: [], unreported: ['web-search' as const, 'web-fetch' as const] }
    assert.throws(
      () => webEvents(cursor, 'web-fetch', 'httpbin', 'fetched()'),
      (e: Error) => {
        assert.equal(e.name, 'HarnessCapabilityError')
        return true
      },
    )
  })
})

describe('toolTarget and toolCalls', () => {
  test('a dedicated skill load stores the skill name as the target', () => {
    assert.equal(toolTarget({ id: 'house-greeting' }, 'skill'), 'house-greeting')
    assert.equal(toolTarget({ name: 'house-greeting' }, 'load_skill'), 'house-greeting')
    assert.equal(toolTarget({ path: 'notes.txt' }, 'read'), 'notes.txt')
    const calls = toolCalls(
      trajectoryByLine(
        `${JSON.stringify({ type: 'tool', tool: 'skill', input: { id: 'foo' } })}\n`,
      ),
    )
    assert.deepEqual(
      calls.map((c) => [c.tool, c.target]),
      [['skill', 'foo']],
    )
  })

  test('a call the harness never reported a result for is neither ok nor failed', () => {
    const lines = [
      { type: 'tool', tool: 'read', input: { path: 'a' }, ok: true },
      { type: 'tool', tool: 'read', input: { path: 'b' }, ok: false },
      { type: 'tool', tool: 'read', input: { path: 'c' }, ok: null },
      { type: 'tool', tool: 'read', input: { path: 'd' } },
    ]
    assert.deepEqual(
      toolCalls(trajectoryByLine(lines.map((l) => JSON.stringify(l)).join('\n'))).map((c) => [
        c.target,
        c.ok,
      ]),
      [
        ['a', true],
        ['b', false],
        ['c', null],
        ['d', true],
      ],
    )
  })
})

const replayRoot = join(testDir, 'replay')
const harnesses = existsSync(replayRoot)
  ? readdirSync(replayRoot, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() &&
          d.name !== 'formats' &&
          d.name !== 'telemetry' &&
          d.name !== 'model-calls',
      )
      .map((d) => d.name)
      .sort()
  : []

const replay = (harness: string, file: string) => {
  const lines = readFileSync(join(replayRoot, harness, file), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { ms: number; part: { type: string; [k: string]: unknown } })
  return normalizeStream(
    lines.map((l) => ({ ms: l.ms, part: l.part as never })),
    0,
  )
}

describe('replay captures through normalizeStream', () => {
  test('there are skill and mcp captures for each harness', () => {
    assert.deepEqual(harnesses, [
      'antigravity',
      'codex',
      'cursor',
      'fx',
      'goose',
      'grok-build',
      'opencode',
      'pi',
    ])
  })

  for (const harness of harnesses) {
    test(`${harness} skill.raw.jsonl: the contract-probe skill`, () => {
      const t = replay(harness, 'skill.raw.jsonl')
      assert.equal(usedSkill(t, 'contract-probe'), true)
      assert.equal(usedSkill(t, 'no-such-skill'), false)
    })

    test(`${harness} mcp.raw.jsonl: stamp's house_stamp`, () => {
      const t = replay(harness, 'mcp.raw.jsonl')
      assert.ok(mcpCalls(t, 'stamp', 'house_stamp').length > 0)
      assert.ok(toolCallsIn(t, 'mcp__stamp__house_stamp').length > 0)
      assert.equal(mcpCalls(t, 'stamp', 'other').length, 0)
      assert.equal(toolCallsIn(t, 'mcp__stamp__other').length, 0)
    })

    test(`${harness} edit-and-run.raw.jsonl: a command and an edit`, () => {
      const t = replay(harness, 'edit-and-run.raw.jsonl')
      assert.equal(ranAny(t, /contract/), true)
      assert.equal(ranAny(t, { program: 'echo', args: /^contract-/ }), true)
      assert.equal(ranAny(t, /deploy/), false)
      assert.deepEqual(editedPaths(t, 'notes.txt'), ['notes.txt'])
    })
  }
})

const CLAUDE_CODE_SKILL =
  'fixtures/records/real-contract/evals/.history/20260929T033538Z_nogit_runner_f3z3/evals-skill-eval-ts-skill-468cc8/claude-code-claude-haiku-4-5-skilled-docker-7add5d/1/transcript.jsonl'

/** Each harness's use of the contract's `contract-probe` skill, as its capture has it. */
const SKILL_USES: Record<AgentKind, { from: string; tool: string; input: unknown }> = {
  cursor: {
    from: 'replay/cursor/skill.raw.jsonl',
    tool: 'read',
    input: { path: '/home/reeval/.agents/skills/contract-probe/SKILL.md' },
  },
  'claude-code': { from: CLAUDE_CODE_SKILL, tool: 'Skill', input: { skill: 'contract-probe' } },
  antigravity: {
    from: 'replay/antigravity/skill.raw.jsonl',
    tool: 'read',
    input: {
      file_path: '/home/reeval/.gemini/config/skills/contract-probe/SKILL.md',
      Path: '/home/reeval/.gemini/config/skills/contract-probe/SKILL.md',
    },
  },
  opencode: {
    from: 'replay/opencode/skill.raw.jsonl',
    tool: 'skill',
    input: { id: 'contract-probe' },
  },
  goose: {
    from: 'replay/goose/skill.raw.jsonl',
    tool: 'load_skill',
    input: { name: 'contract-probe' },
  },
  pi: {
    from: 'replay/pi/skill.raw.jsonl',
    tool: 'read',
    input: { path: '/home/reeval/.pi/agent/skills/contract-probe/SKILL.md', limit: 100, offset: 1 },
  },
  codex: {
    from: 'replay/codex/skill.raw.jsonl',
    tool: 'bash',
    input: {
      command: `/bin/bash -lc "sed -n '1,240p' /home/reeval/.agents/skills/contract-probe/SKILL.md"`,
    },
  },
  fx: {
    from: 'replay/fx/skill.raw.jsonl',
    tool: 'skill',
    input: { location: 'skill:61ce5ec8bc2106bf:0/contract-probe', name: 'contract-probe' },
  },
  'grok-build': {
    from: 'replay/grok-build/skill.raw.jsonl',
    tool: 'read_file',
    input: {
      target_file:
        '/home/reeval/.ai-sdk-harness/.harness-bootstrap/grok-build/home/.grok/skills/contract-probe/SKILL.md',
    },
  },
}

/** A capture's normalized tool calls: a replay stream through normalizeStream, or a trajectory. */
const capturedTools = (from: string) => {
  const text = readFileSync(join(testDir, from), 'utf8')
  const events = from.endsWith('.raw.jsonl')
    ? normalizeStream(
        text
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l))
          .map((l) => ({ ms: l.ms, part: l.part as never })),
        0,
      )
    : (text
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l)) as TrajectoryEvent[])
  return events.flatMap((e) => (e.type === 'tool' ? [{ tool: e.tool, input: e.input }] : []))
}

describe("every harness's skill use", () => {
  test('there is a row for each harness in the catalog', () => {
    assert.deepEqual(Object.keys(SKILL_USES).sort(), Object.keys(AGENTS).sort())
  })

  for (const [harness, use] of Object.entries(SKILL_USES)) {
    test(`${harness}: the row is in ${use.from}`, () => {
      assert.ok(
        capturedTools(use.from).some(
          (t) => t.tool === use.tool && JSON.stringify(t.input) === JSON.stringify(use.input),
        ),
      )
    })

    test(`${harness}: skillCalls, skill_reads and the context class all see it`, () => {
      const t = [tool(use.tool, use.input)]
      assert.equal(usedSkill(t, 'contract-probe'), true)
      assert.equal(usedSkill(t, 'contract'), false)
      assert.equal(usedSkill(t, 'probe'), false)
      const [call] = toolCalls(
        trajectoryByLine(JSON.stringify({ type: 'tool', tool: use.tool, input: use.input })),
      )
      assert.ok(call)
      assert.deepEqual(skillsUsed(call.tool, call.text, ['other', 'contract-probe']), [
        'contract-probe',
      ])
      assert.ok(!call.target.startsWith('{'), `${call.target} is a named input, not the JSON`)
      const ctx = {
        skills: ['contract-probe'],
        skillDirs: SKILL_DIRS,
        files: [],
        mcp: [],
        verify: [],
      }
      assert.equal(classifyCall(call.tool, call.text, ctx).class, 'context')
    })
  }

  test("Claude Code's plugin skill is <plugin>:<name>", () => {
    const t = [tool('Skill', { skill: 'house:contract-probe' })]
    assert.equal(usedSkill(t, 'contract-probe'), true)
    assert.equal(usedSkill(t, 'house:contract-probe'), true)
    assert.equal(usedSkill(t, 'house'), false)
  })

  test('a shell command that cds into the skill reads it; one that excludes it does not', () => {
    const cd = [tool('bash', { command: 'cd ~/.agents/skills/foo && cat SKILL.md' })]
    assert.equal(usedSkill(cd, 'foo'), true)
    assert.equal(usedSkill(cd, 'foo-bar'), false)
    const excluded = [tool('bash', { command: 'rg -n todo --glob "!skills/foo/**"' })]
    assert.equal(usedSkill(excluded, 'foo'), false)
    const tested = [tool('bash', { command: '[ -d ~/.agents/skills/foo ] && echo yes' })]
    assert.equal(usedSkill(tested, 'foo'), false)
  })
})

describe('budgetUsed and overLimits', () => {
  const usage = { input: 900, output: 100, cacheRead: 50, cacheWrite: 0, reasoning: null }
  const budgetTurn = (
    trajectory: TrajectoryEvent[],
    durationMs = 1000,
    u: typeof usage | null = usage,
  ) => ({
    trajectory,
    durationMs,
    usage: u,
  })
  const one = budgetTurn([
    tool('bash', { command: 'ls' }),
    tool('bash', { command: 'pwd' }),
    edit('a.ts'),
  ])
  const two = budgetTurn([tool('bash', { command: 'make' })], 2000)
  const over = (
    turns: Parameters<typeof budgetUsed>[0],
    limits: Parameters<typeof overLimits>[1],
  ) => {
    const used = budgetUsed(turns)
    return overLimits({ ...used, tokens: used.tokens ?? 0 }, limits)
  }

  test('a turn within each limit has nothing over; over one names it with the figure', () => {
    assert.deepEqual(over([one], { tokens: 1050, toolCalls: 3, duration: '1s' }), [])
    assert.deepEqual(over([one], { tokens: 1000, toolCalls: { bash: 1, read: 0 } }), [
      'tokens 1,050 > 1,000 (subagents included)',
      'bash 2 > 1',
    ])
  })

  test('sums every turn', () => {
    assert.deepEqual(over([one, two], { toolCalls: { bash: 3 }, tokens: 2100 }), [])
    assert.deepEqual(over([one, two], { toolCalls: { bash: 2 }, duration: '2s' }), [
      'bash 3 > 2',
      'duration 3s > 2s',
    ])
  })

  test('a null usage has no token figure', () => {
    assert.equal(budgetUsed([budgetTurn([tool('bash', {})], 10, null)]).tokens, null)
  })

  test('limitsProblem refuses bad limits', () => {
    const problem = (limits: unknown) =>
      limitsProblem(limits, 'withinLimits()', ['tokens', 'toolCalls', 'duration'], 'e.g. …')
    assert.match(problem({}) ?? '', /needs at least one limit/)
    assert.match(
      problem({ toolcalls: 3 }) ?? '',
      /no limit "toolcalls".*Did you mean "toolCalls"\?/,
    )
    assert.match(problem({ tokens: -1 }) ?? '', /tokens is a whole number/)
    assert.match(problem({ toolCalls: { bash: 1.5 } }) ?? '', /toolCalls\.bash is a whole number/)
    assert.match(problem({ duration: 'soon' }) ?? '', /duration: Invalid duration/)
    assert.equal(problem({ tokens: 5 }), undefined)
  })
})
