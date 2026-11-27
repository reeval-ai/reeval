// reeval/graders' built-ins and reeval/graders/match: their names, options and data form, their
// fingerprints, and what each grades from a trial's turns, execs, diff and captures.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  builtinFromData,
  calledMcp,
  calledTool,
  cost,
  fetched,
  hasFile,
  inDiff,
  notInDiff,
  observed,
  pageStatus,
  ran,
  searched,
  succeeded,
  tokens,
  turns,
  usedSkill,
  withinLimits,
  wrote,
} from '../src/grade/builtins.ts'
import type { GradeInputs } from '../src/grade/context.ts'
import { type GraderDef, graderDef } from '../src/grade/define.ts'
import * as match from '../src/grade/match.ts'
import { runGraders } from '../src/grade/run.ts'
import type { Grader, GraderTurn } from '../src/grade/types.ts'
import type { TrajectoryEvent } from '../src/types.ts'

const at = { ts: '2026-01-01T00:00:00.000Z', atMs: 0 }

const tool = (name: string, input: unknown, id = name): TrajectoryEvent => ({
  ...at,
  type: 'tool',
  toolCallId: id,
  tool: name,
  input,
  output: '',
  outputView: 'model',
  ok: true,
  durationMs: 0,
})

const TRAJECTORY: TrajectoryEvent[] = [
  tool('Skill', { skill: 'http-retries' }, 's'),
  tool('bash', { command: 'npm test -- --run' }, 'b1'),
  tool('bash', { command: 'ls' }, 'b2'),
  tool('mcp__docs__search', { query: 'retry' }, 'm'),
  {
    ...at,
    type: 'file-edit',
    toolCallId: 'e',
    path: 'src/retry.ts',
    kind: 'create',
    added: 1,
    removed: 0,
    input: {},
    output: '',
    outputView: 'model',
    durationMs: 0,
  },
  {
    ...at,
    type: 'web-search',
    toolCallId: 'w1',
    query: 'Retry-After header',
    references: null,
    ok: true,
    input: {},
    output: '',
    outputView: 'model',
    durationMs: 0,
  },
  {
    ...at,
    type: 'web-fetch',
    toolCallId: 'w2',
    url: 'https://developer.mozilla.org/docs/Web/HTTP/Headers/Retry-After',
    ok: true,
    input: {},
    output: '',
    outputView: 'model',
    durationMs: 0,
  } as TrajectoryEvent,
]

const turn = (over: Partial<GraderTurn> = {}): GraderTurn => ({
  prompt: 'add retries',
  text: 'Done.',
  status: 'completed',
  startedAt: at.ts,
  durationMs: 1500,
  trajectory: TRAJECTORY,
  usage: { input: 1000, output: 200, cacheRead: 0, cacheWrite: 0, reasoning: null },
  model: null,
  unreported: [],
  cost: { usd: 0.25, basis: 'reported', source: 'fake' },
  ...over,
})

function inputs(over: Partial<GradeInputs> = {}): GradeInputs {
  const png = Buffer.from('png')
  return {
    case: { key: '' },
    turns: [turn(), turn({ trajectory: [] })],
    skills: ['http-retries', 'unused'],
    stored: {
      execs: [
        { command: 'npm test', label: 'tests', exitCode: 1, stdout: '', stderr: '', durationMs: 1 },
        { command: 'npm test', label: 'tests', exitCode: 0, stdout: '', stderr: '', durationMs: 1 },
        { command: 'npm run build', exitCode: 2, stdout: '', stderr: '', durationMs: 1 },
      ],
      observations: [{ name: 'health', value: 200, turn: 1, sha256: 'h' }],
      artifacts: [
        {
          name: 'home',
          path: 'home.png',
          sha256: 'a',
          bytes: 3,
          mediaType: 'image/png',
          capture: { status: 302, pageErrors: 2 } as never,
        },
      ],
      readArtifact: async (name) => (name === 'home' ? png : null),
      workspace: null,
      changedFiles: [
        { path: 'src/retry.ts', status: 'added' },
        { path: 'README.md', status: 'modified' },
      ],
    },
    ...over,
  }
}

const def = (g: Grader) => graderDef(g) as GraderDef

const grade = async (g: Grader, given = inputs()) =>
  (await runGraders([def(g)], given, new AbortController().signal))[0]

describe('reeval/graders/match', () => {
  const c = { turns: inputs().turns, skills: ['http-retries', 'unused'] }
  test('reads the trajectory as the matchers do', () => {
    assert.equal(match.calledSkill(c, 'http-retries'), true)
    assert.equal(match.calledSkill(c, 'other'), false)
    assert.deepEqual(match.usedSkills(c), ['http-retries'])
    assert.equal(match.calledTool(c, 'bash'), 2)
    assert.equal(match.calledTool(c, 'bash', { command: /npm test/ }), 1)
    assert.equal(match.calledTool(c, /^mcp__/), 1)
    assert.equal(match.calledMcp(c, 'docs'), 1)
    assert.equal(match.calledMcp(c, 'docs', 'search'), 1)
    assert.equal(match.calledMcp(c, 'docs', 'fetch'), 0)
    assert.equal(match.ran(c, /npm test/), 1)
    assert.equal(match.ran(c, { program: 'npm', args: 'test' }), 1)
    assert.equal(match.ran(c), 2)
    assert.deepEqual(match.wrote(c, 'src/retry.ts'), ['src/retry.ts'])
    assert.deepEqual(match.wrote(c, /\.md$/), [])
  })
  test('counts web searches and fetches, and throws where a harness reports none', () => {
    assert.equal(match.searched(c, /retry-after/i), 1)
    assert.equal(match.fetched(c, 'https://developer.mozilla.org/'), 1)
    assert.equal(match.fetched(c, 'https://example.com/'), 0)
    const blind = { turns: [turn({ unreported: ['web-search'] })] }
    assert.throws(() => match.searched(blind), /doesn't report web searches/)
  })
  test('reads the final diff', () => {
    const d = { changedFiles: inputs().stored.changedFiles }
    assert.deepEqual(match.inDiff(d, 'src/**'), ['src/retry.ts'])
    assert.deepEqual(match.inDiff(d, ['README.md', /^src\//]), ['src/retry.ts', 'README.md'])
    assert.deepEqual(match.inDiff(d, 'test/**'), [])
    assert.deepEqual(match.inDiff(d), ['src/retry.ts', 'README.md'])
  })
  test('finds a c.exec by label, then by command, the last one', () => {
    const e = { execs: inputs().stored.execs }
    assert.equal(match.succeeded(e, 'tests'), 0)
    assert.equal(match.succeeded(e, 'npm run build'), 2)
    assert.throws(
      () => match.succeeded(e, 'lint'),
      /ran no c\.exec labeled or running "lint" \(it ran "tests", "npm run build"\)/,
    )
  })
  test('sums usage over the turns', () => {
    assert.deepEqual(match.usage(c), {
      turns: 2,
      tokens: 2400,
      toolCalls: 7,
      durationMs: 3000,
      cost: 0.5,
    })
    const unknown = { turns: [turn({ usage: null, cost: undefined })] }
    assert.equal(match.usage(unknown).tokens, null)
    assert.equal(match.usage(unknown).cost, null)
    const free = {
      turns: [
        turn(),
        turn({
          cost: undefined,
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: null },
        }),
      ],
    }
    assert.equal(match.usage(free).cost, 0.25, 'a turn that used no tokens needs no cost')
    assert.equal(match.toolCallsOf(c, 'bash'), 2)
  })
})

describe('built-in graders', () => {
  test('are named <kind>:<main argument>', () => {
    assert.deepEqual(
      [
        usedSkill('http-retries'),
        usedSkill(),
        calledTool('bash', { command: /npm test/ }),
        calledMcp('docs', 'search'),
        ran(/vitest run/),
        ran({ program: 'npm', args: 'test' }),
        searched(),
        wrote('src/client.ts'),
        inDiff(['src/**', 'lib/**']),
        notInDiff('test/**/*.test.ts'),
        hasFile('src/retry.ts', /retry/),
        succeeded('npm run build'),
        withinLimits({ tokens: 1 }),
        tokens(),
        pageStatus('settings', 200),
        observed('health'),
        turns({ name: 'turn-count' }),
      ].map((g) => g.name),
      [
        'used-skill:http-retries',
        'used-skill',
        'called-tool:bash',
        'called-mcp:docs/search',
        'ran:/vitest run/',
        'ran:program npm args test',
        'searched',
        'wrote:src/client.ts',
        'in-diff:src/**,lib/**',
        'not-in-diff:test/**/*.test.ts',
        'has-file:src/retry.ts',
        'succeeded:npm run build',
        'within-limits',
        'tokens',
        'page-status:settings',
        'observed:health',
        'turn-count',
      ],
    )
  })
  test('quote a list item with a comma, so two lists never share a name', () => {
    assert.equal(inDiff(['a', 'b']).name, 'in-diff:a,b')
    assert.equal(inDiff(['a,b']).name, 'in-diff:"a,b"')
    assert.equal(inDiff([/a,b/]).name, 'in-diff:"/a,b/"')
  })
  test('take options after the arguments, or alone', () => {
    const g = def(calledTool('bash', { weight: 2, required: true }))
    assert.deepEqual([g.weight, g.required, g.builtin?.args], [2, true, ['bash']])
    const input = def(calledTool('bash', { weight: 2 }, {}))
    assert.deepEqual(
      input.builtin?.args,
      ['bash', { weight: 2 }],
      'an input of option keys, with options',
    )
    assert.equal(def(usedSkill({ weight: 0 })).weight, 0)
  })
  test('grade natural passes as 1 or 0', async () => {
    const graded = await Promise.all(
      [
        usedSkill('http-retries'),
        usedSkill(),
        calledTool('bash', { command: /npm test/ }),
        calledMcp('docs', 'fetch'),
        ran(/npm test/),
        searched(/retry-after/i),
        fetched(/mozilla/),
        wrote(),
        inDiff('src/**'),
        notInDiff('src/**'),
        succeeded('tests'),
        succeeded('npm run build'),
        withinLimits({ tokens: 2400, toolCalls: { bash: 2 }, duration: '3s', cost: 0.5 }),
        withinLimits({ toolCalls: 3 }),
        pageStatus('home', '3xx'),
        pageStatus('home', 200),
        observed<number>('health', (s) => s === 200),
      ].map((g) => grade(g)),
    )
    assert.deepEqual(
      graded.map((g) => [g?.grader, g?.grade, g?.score, g?.error]),
      [
        ['used-skill:http-retries', true, 1, undefined],
        ['used-skill', ['http-retries'], 1, undefined],
        ['called-tool:bash', 1, 1, undefined],
        ['called-mcp:docs/fetch', 0, 0, undefined],
        ['ran:/npm test/', 1, 1, undefined],
        ['searched:/retry-after/i', 1, 1, undefined],
        ['fetched:/mozilla/', 1, 1, undefined],
        ['wrote', ['src/retry.ts'], 1, undefined],
        ['in-diff:src/**', ['src/retry.ts'], 1, undefined],
        ['not-in-diff:src/**', ['src/retry.ts'], 0, undefined],
        ['succeeded:tests', 0, 1, undefined],
        ['succeeded:npm run build', 2, 0, undefined],
        [
          'within-limits',
          { tokens: 2400, toolCalls: { bash: 2 }, duration: 3000, cost: 0.5 },
          1,
          undefined,
        ],
        ['within-limits', { toolCalls: 7 }, 0, undefined],
        ['page-status:home', 302, 1, undefined],
        ['page-status:home', 302, 0, undefined],
        ['observed:health', 200, 1, undefined],
      ],
    )
  })
  test('record usage with no score unless given one', async () => {
    const graded = await Promise.all(
      [turns(), tokens(), cost(), cost({ score: (usd) => (usd !== null && usd < 1 ? 1 : 0) })].map(
        (g) => grade(g),
      ),
    )
    assert.deepEqual(
      graded.map((g) => [g?.grade, g?.score]),
      [
        [2, null],
        [2400, null],
        [0.5, null],
        [0.5, 1],
      ],
    )
  })
  test('error when the evidence is missing, which fails a required one', async () => {
    const blind = inputs({ turns: [turn({ usage: null, unreported: ['web-fetch'] })] })
    const [limits, fetches, exec, file] = await Promise.all([
      grade(withinLimits({ tokens: 10 }), blind),
      grade(fetched(), blind),
      grade(succeeded('lint')),
      grade(hasFile('src/retry.ts')),
    ])
    assert.match(limits?.error ?? '', /reported no token usage/)
    assert.match(fetches?.error ?? '', /doesn't report web fetches/)
    assert.match(exec?.error ?? '', /ran no c\.exec/)
    assert.match(file?.error ?? '', /kept no workspace/)
  })
  test('fingerprint their kind, arguments and version, not their options', () => {
    const fp = async (g: Grader) => (await grade(g))?.fingerprint
    return Promise.all([
      fp(calledTool('bash')),
      fp(calledTool('bash', { weight: 3, required: true })),
      fp(calledTool('bash', { command: 'npm test' })),
      fp(calledTool('bash', { score: (n) => Math.min(n, 1) })),
    ]).then(([plain, weighted, input, scored]) => {
      assert.equal(plain?.version, 1)
      assert.equal(weighted?.digest, plain?.digest)
      assert.equal(scored?.digest, plain?.digest, 'score is its own digest, not the code')
      assert.notEqual(input?.digest, plain?.digest)
    })
  })
  test('round-trip through their data form', async () => {
    const original = calledTool('bash', { command: /npm test/i }, { weight: 2, required: true })
    const data = def(original).builtin?.data
    assert.deepEqual(data, {
      builtin: 'called-tool',
      args: ['bash', { command: { regexp: 'npm test', flags: 'i' } }],
      weight: 2,
      required: true,
    })
    const again = builtinFromData(JSON.parse(JSON.stringify(data)), 'graders in test')
    assert.equal(again.name, original.name)
    assert.deepEqual((await grade(again))?.fingerprint, (await grade(original))?.fingerprint)
    assert.equal(def(turns({ score: () => 1 })).builtin?.data, undefined)
    assert.equal(def(observed('ok', (v) => v === true)).builtin?.data, undefined)
  })
})
