// An eval file's declarations as data (src/declaration.ts): what defineEval records, and that
// the tree, through JSON and declared again, plans the same tests as the file did.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { validate } from '../scripts/schema/validate.ts'
import { cursor, fakeAgent } from '../src/agent.ts'
import { resolveConfig } from '../src/config.ts'
import type { DeclarationTree } from '../src/declaration.ts'
import { collect, collectingFile, registerGroup, registerTest } from '../src/engine/collector.ts'
import { useEngine } from '../src/engine/runtime.ts'
import { defineEnvironment } from '../src/environment.ts'
import {
  declareDefault,
  declaredBody,
  declaredTree,
  declareTree,
  defineEval,
} from '../src/evaluate.ts'
import { harnessId } from '../src/options.ts'
import { planEval } from '../src/plan-eval.ts'
import type { RunContext } from '../src/types.ts'
import { tempDir } from './helpers.ts'

function runIn(root: string): RunContext {
  const config = resolveConfig(
    {
      agents: [fakeAgent(), cursor({ model: 'composer-2.5' })],
      trials: 1,
    },
    root,
  )
  return { runId: 'r', stagingDir: root, config, tags: [], concurrency: 4, profile: null }
}

/** Collects `rel` under `root` with `declare`, as a worker would. */
async function collected(root: string, declare: (file: string) => void, rel = 'evals/x.eval.py') {
  const run = runIn(root)
  useEngine({
    registerTest,
    registerGroup,
    getRunContext: () => run,
    collectingFile,
    declarePlanned: () => {},
  })
  const file = join(root, rel)
  const tests = await collect(file, async () => declare(file))
  return {
    file,
    tests: tests.map(({ index, name, groups, mode, options }) => ({
      index,
      name,
      groups,
      mode,
      options,
    })),
  }
}

/**
 * Loads `evals/<id>.eval.ts`, whose default export is `defineEval(spec)`. A worker loads one
 * file; here every file shares one process, so the `defineEval` results made so far are
 * forgotten first.
 */
const loaded = (root: string, id: string, spec: () => object) =>
  collected(
    root,
    (file) => {
      ;(globalThis as Record<symbol, unknown>)[Symbol.for('reeval.defined')] = []
      declareDefault(file, { default: defineEval(spec() as never) })
    },
    `evals/${id}.eval.ts`,
  )

const plain = defineEnvironment('plain', {})
const skill = defineEnvironment('skill', { rules: 'Use the house style.' })

/** Eval files by id, each its default export's spec. */
const EVALS: Record<string, () => object> = {
  a: () => ({ trials: 2, tags: ['smoke'], agents: { only: 'fake' }, task: async () => {} }),
  skipped: () => ({ skip: 'not yet', task: async () => {} }),
  c: () => ({
    agents: { add: cursor({ model: 'composer-2', id: 'fast' }) },
    compare: { baseline: plain, variants: [skill] },
    task: async () => {},
  }),
  d: () => ({ timeout: '2m', egress: 'deny-all', environment: skill, task: async () => {} }),
  case: () => ({ cases: [{ key: '1' }, { key: '2' }], task: async () => {} }),
}

/**
 * Every eval file in `EVALS`, collected once: an id is declared once per process, as a worker
 * collects one file.
 */
let collectedAll: Promise<Record<string, Awaited<ReturnType<typeof loaded>>>> | undefined
const all = () => {
  collectedAll ??= (async () => {
    const root = tempDir('declared')
    const out: Record<string, Awaited<ReturnType<typeof loaded>>> = {}
    for (const [id, spec] of Object.entries(EVALS)) out[id] = await loaded(root, id, spec)
    return out
  })()
  return collectedAll
}

/** A tree as a runner in another language declares it, in a group. */
const groupedTree = (): DeclarationTree['children'] =>
  [
    {
      type: 'group',
      name: 'outer',
      mode: 'run',
      options: { tags: ['smoke'], agents: { only: 'fake' } },
      children: [
        {
          type: 'eval',
          name: 'a',
          mode: 'run',
          options: { trials: 2 },
          body: 'g1',
          source: { body: '0'.repeat(64) },
        },
        {
          type: 'group',
          name: 'skipped',
          mode: 'skip',
          options: {},
          children: [
            {
              type: 'eval',
              name: 'b',
              mode: 'run',
              options: {},
              body: 'g2',
              source: { body: '1'.repeat(64) },
            },
          ],
        },
      ],
    },
    { type: 'todo', name: 'later' },
  ] as DeclarationTree['children']

const shape = (nodes: DeclarationTree['children']): unknown[] =>
  nodes.map((n) =>
    n.type === 'todo'
      ? `todo ${n.name}`
      : n.type === 'eval'
        ? `${n.mode} ${n.name}`
        : { [`${n.mode} ${n.name}`]: shape(n.children) },
  )

test('defineEval records its eval in the tree, and its body by id', async () => {
  const files = await all()
  const shapes = Object.fromEntries(
    Object.entries(files).map(([id, { file }]) => {
      const data = JSON.parse(JSON.stringify(declaredTree(file))) as DeclarationTree
      for (const node of data.children)
        if (node.type === 'eval') assert.equal(typeof declaredBody(node.body), 'function', id)
      return [id, shape(data.children)]
    }),
  )
  assert.deepEqual(shapes, {
    a: ['run a'],
    skipped: ['skip skipped'],
    c: ['run c'],
    d: ['run d'],
    case: ['run case#1', 'run case#2'],
  })
  assert.deepEqual(
    [files.a, files.skipped].flatMap((f) => f?.tests.map((t) => `${t.mode} ${t.name}`)),
    ['run a [fake/-/docker#1]', 'run a [fake/-/docker#2]', 'skip skipped [fake/-/docker#1]'],
  )
})

/** Tests with the scheduler's tie-break, which counts the evals this process planned, from 0. */
const fromZero = (tests: { options: { gate?: { rank: { order: number } } } }[]) => {
  const first = Math.min(...tests.map((t) => t.options.gate?.rank.order ?? Infinity))
  return JSON.parse(
    JSON.stringify(tests, (key, value) =>
      key === 'order' && typeof value === 'number' ? value - first : value,
    ),
  )
}

test('a grouped tree through JSON, declared again, plans the same tests', async () => {
  const bodies = { g1: async () => {}, g2: async () => {} }
  const first = await collected(tempDir('grouped'), () =>
    declareTree(groupedTree(), (body) => bodies[body as keyof typeof bodies]),
  )
  const tree = JSON.parse(JSON.stringify(declaredTree(first.file))) as DeclarationTree
  assert.deepEqual(shape(tree.children), [
    { 'run outer': ['run a', { 'skip skipped': ['run b'] }] },
    'todo later',
  ])
  const replayed = await collected(tempDir('grouped-again'), () =>
    declareTree(tree.children, (body) => declaredBody(body) as never),
  )
  assert.deepEqual(fromZero(replayed.tests), fromZero(first.tests))
  assert.deepEqual(
    first.tests.map((t) => `${t.mode} ${[...t.groups, t.name].join(' › ')}`),
    [
      'run outer › a [fake/-/docker#1]',
      'run outer › a [fake/-/docker#2]',
      'skip outer › skipped › b [fake/-/docker#1]',
      'todo later',
    ],
  )
})

test("an eval's graders as data plan through the tree, and come back out of it", async () => {
  const graders = [
    { builtin: 'turns' },
    { builtin: 'in-diff', args: ['src/**'], weight: 2, required: true },
    { builtin: 'ran', args: [{ regexp: 'npm test', flags: 'i' }] },
    { builtin: 'observed', args: ['health'] },
  ]
  const node = {
    type: 'eval',
    name: 'graded',
    mode: 'run',
    options: { agents: { only: 'fake' } },
    graders,
    body: 'g',
    source: { body: '2'.repeat(64) },
  } as DeclarationTree['children'][number]
  const first = await collected(tempDir('tree-graders'), () =>
    declareTree([node], () => async () => {}),
  )
  const planned = (tests: typeof first.tests) =>
    tests.map(
      (t) => (t.options as { trial: { plan: { graders?: unknown } } }).trial.plan.graders,
    )
  assert.deepEqual(planned(first.tests), [
    [
      { name: 'turns', kind: 'builtin', weight: 1, required: false, recordsOnly: true },
      { name: 'in-diff:src/**', kind: 'builtin', weight: 2, required: true },
      { name: 'ran:/npm test/i', kind: 'builtin', weight: 1, required: false },
      { name: 'observed:health', kind: 'builtin', weight: 1, required: false },
    ],
  ])
  const tree = JSON.parse(JSON.stringify(declaredTree(first.file))) as DeclarationTree
  const [declared] = tree.children
  assert.deepEqual(declared?.type === 'eval' ? declared.graders : undefined, graders)
  const replayed = await collected(tempDir('tree-graders-again'), () =>
    declareTree(tree.children, () => async () => {}),
  )
  assert.deepEqual(planned(replayed.tests), planned(first.tests))
})

/** A tree as another language writes it: host paths relative to the eval file, evals/x.eval.py. */
function relativeTree(): DeclarationTree['children'] {
  const env = (name: string, spec: object) => ({
    kind: 'environment',
    name,
    layers: [{ name, spec }],
  })
  const docker = (dockerfile: string) => ({ kind: 'docker', dockerfile })
  const context = env('context', {
    files: { 'a.txt': { kind: 'file', path: './fixtures/a.txt' } },
    rules: { kind: 'file', path: '../RULES.md' },
    skills: [
      { kind: 'skill', source: 'local', path: './skills', placement: 'harness' },
      { kind: 'skill', source: 'npm', spec: '../pkg.tgz', path: 'skills', placement: 'harness' },
    ],
    workspace: { kind: 'git', repo: '../app', url: '../app' },
  })
  const eval_ = (name: string, options: object, extra: object = {}) => ({
    type: 'eval' as const,
    name,
    mode: 'run' as const,
    options,
    body: 'b1',
    source: { body: '0'.repeat(64) },
    ...extra,
  })
  return [
    {
      type: 'group',
      name: 'fake',
      mode: 'run',
      options: { agents: { only: 'fake' }, sandbox: { kind: 'fake', dir: './sandboxes' } },
      children: [eval_('context', { environments: context })],
    },
    eval_('compare', {
      compare: {
        baseline: env('plain', { sandbox: docker('./images/Dockerfile') }),
        variants: [env('built', { sandbox: docker('../docker/Dockerfile') })],
      },
    }),
    ...[0, 1].map((i) =>
      eval_(
        `case ${i}`,
        { sandbox: docker('images/Dockerfile') },
        {
          family: { name: 'case %#', case: i, cases: 2 },
        },
      ),
    ),
  ] as DeclarationTree['children']
}

/** A project with the Dockerfiles the relative tree names. */
function pathsProject(name: string): string {
  const root = tempDir(name)
  for (const dir of ['evals/images', 'docker']) {
    mkdirSync(join(root, dir), { recursive: true })
    writeFileSync(join(root, dir, 'Dockerfile'), 'FROM debian:bookworm-slim\n')
  }
  return root
}

/** Every host path a declared tree's options hold, by where it sits. */
function hostPaths(nodes: DeclarationTree['children'], into: Record<string, string> = {}) {
  const at = (value: unknown, path: string) => {
    if (typeof value !== 'object' || value === null) return
    const v = value as Record<string, unknown>
    if (v.kind === 'fake' && typeof v.dir === 'string') into[`${path}.dir`] = v.dir
    if (v.kind === 'docker' && typeof v.dockerfile === 'string')
      into[`${path}.dockerfile`] = v.dockerfile
    if (v.kind === 'file' && typeof v.path === 'string') into[`${path}.path`] = v.path
    if (v.source === 'local' && typeof v.path === 'string') into[`${path}.path`] = v.path
    if (v.source === 'npm' && typeof v.spec === 'string') into[`${path}.spec`] = v.spec
    if (v.kind === 'git' && typeof v.url === 'string') into[`${path}.url`] = v.url
    for (const [key, child] of Object.entries(v)) at(child, `${path}.${key}`)
  }
  for (const node of nodes) {
    if (node.type === 'todo') continue
    at(node.options, `${node.name}`)
    if (node.type === 'group') hostPaths(node.children, into)
  }
  return into
}

test("a tree's relative host paths resolve against the declaring file's directory", async () => {
  const root = pathsProject('tree-paths')
  const evals = join(root, 'evals')
  const { file } = await collected(root, () => declareTree(relativeTree(), () => async () => {}))
  const tree = JSON.parse(JSON.stringify(declaredTree(file))) as DeclarationTree
  assert.deepEqual(hostPaths(tree.children), {
    'fake.sandbox.dir': join(evals, 'sandboxes'),
    'context.environments.layers.0.spec.files.a.txt.path': join(evals, 'fixtures/a.txt'),
    'context.environments.layers.0.spec.rules.path': join(root, 'RULES.md'),
    'context.environments.layers.0.spec.skills.0.path': join(evals, 'skills'),
    'context.environments.layers.0.spec.skills.1.spec': join(root, 'pkg.tgz'),
    'context.environments.layers.0.spec.workspace.url': join(root, 'app'),
    'compare.compare.baseline.layers.0.spec.sandbox.dockerfile': join(evals, 'images/Dockerfile'),
    'compare.compare.variants.0.layers.0.spec.sandbox.dockerfile': join(root, 'docker/Dockerfile'),
    'case 0.sandbox.dockerfile': join(evals, 'images/Dockerfile'),
    'case 1.sandbox.dockerfile': join(evals, 'images/Dockerfile'),
  })
})

test('a tree with relative paths plans the same tests as with absolute ones', async () => {
  const root = pathsProject('tree-relative')
  const relative = await collected(root, () => declareTree(relativeTree(), () => async () => {}))
  const absolute = JSON.parse(JSON.stringify(declaredTree(relative.file))) as DeclarationTree
  const elsewhere = await collected(tempDir('tree-absolute'), () =>
    declareTree(absolute.children, () => async () => {}),
  )
  const order = (tests: typeof relative.tests) =>
    JSON.parse(
      JSON.stringify(tests, (key, value) =>
        key === 'order' && typeof value === 'number' ? 0 : value,
      ),
    )
  assert.equal(relative.tests.length, 9)
  assert.deepEqual(order(elsewhere.tests), order(relative.tests))
  const replayed = JSON.parse(JSON.stringify(declaredTree(elsewhere.file))) as DeclarationTree
  assert.deepEqual(hostPaths(replayed.children), hostPaths(absolute.children))
})

test("a tree's missing Dockerfile is refused at its absolute path, naming the field", async () => {
  const root = tempDir('tree-missing')
  const sandbox = { kind: 'docker', dockerfile: './Dockerfile' }
  const env = { kind: 'environment', name: 'e', layers: [{ name: 'e', spec: { sandbox } }] }
  const node = (options: object) =>
    [
      {
        type: 'eval',
        name: 'e',
        mode: 'run',
        options,
        body: 'b1',
        source: { body: '0'.repeat(64) },
      },
    ] as DeclarationTree['children']
  const full = join(root, 'evals', 'Dockerfile')
  for (const [options, field] of [
    [{ sandbox }, 'sandbox.dockerfile'],
    [{ environments: env }, 'environments.layers[0].spec.sandbox.dockerfile'],
    [
      { compare: { baseline: env, variants: [] } },
      'compare.baseline.layers[0].spec.sandbox.dockerfile',
    ],
  ] as const) {
    await assert.rejects(
      () => collected(root, () => declareTree(node(options), () => async () => {})),
      {
        name: 'UsageError',
        message: `${field} in evaluate("e"): ${full} doesn't exist. Paths are relative to the file that declares it.`,
      },
    )
  }
})

test('replaying a tree with compare: false is refused as a TypeScript eval is', async () => {
  await assert.rejects(
    () =>
      collected(tempDir('false-compare'), () =>
        declareTree(
          [
            {
              type: 'eval',
              name: 'e',
              mode: 'run',
              options: { compare: false } as never,
              body: 'b1',
              source: { body: '0'.repeat(64) },
            },
          ],
          () => async () => {},
        ),
      ),
    /compare: false can't be set in evaluate\("e"\)/,
  )
})

test('a malformed tree is refused before anything is declared', async () => {
  const root = tempDir('malformed')
  const declared = await collected(root, () => {
    assert.throws(
      () =>
        declareTree(
          [
            {
              type: 'eval',
              name: 'a',
              mode: 'run',
              options: {},
              body: 'b1',
              source: { body: '0'.repeat(64) },
            },
            { type: 'eval', name: 'b', mode: 'run', options: {}, bdy: 'b2' } as never,
          ],
          () => async () => {},
        ),
      /^UsageError: The declaration tree's children\[1\] has an unknown key "bdy". Did you mean "body"\?$/,
    )
  })
  assert.deepEqual(declared.tests, [])
})

test('planEval is pure: the same declaration and context give the same tests, gate as data', () => {
  const run = runIn(tempDir('pure'))
  const ctx = { ...run, file: join(run.config.root, 'evals/p.eval.ts'), order: 3 }
  const declaration = {
    name: 'p',
    mode: 'run' as const,
    groups: [],
    options: { trials: 2 },
    source: { body: '0'.repeat(64) },
  }
  const { tests: once, harnesses } = planEval(declaration, ctx)
  assert.deepEqual(
    JSON.parse(JSON.stringify(planEval(declaration, ctx).tests)),
    JSON.parse(JSON.stringify(once)),
  )
  assert.equal(once?.length, 4)
  assert.deepEqual(harnesses, run.config.harness.map(harnessId))
  assert.deepEqual(once?.[0]?.gate, {
    limits: { trials: 4 },
    rank: { eval: 'p', file: 'evals/p.eval.ts', order: 3, n: 1, cell: 0 },
  })
  assert.deepEqual(
    planEval({ ...declaration, options: { tags: ['x'] } }, { ...ctx, tags: ['y'] }),
    { tests: null, harnesses, traits: [] },
    'an eval the tags leave out still names its harnesses, and no trait keys',
  )
})

test("planEval holds the engine's backstop to the longest timer Node can set", () => {
  const run = runIn(tempDir('backstop'))
  const ctx = { ...run, file: join(run.config.root, 'evals/p.eval.ts'), order: 0 }
  const environment = defineEnvironment('slow', { setup: [{ run: 'ls', timeout: '30m' }] })
  const plan = (timeout: string) =>
    planEval(
      {
        name: 'p',
        mode: 'run',
        groups: [],
        options: { timeout, environments: environment },
        source: { body: '0'.repeat(64) },
      },
      ctx,
    ).tests?.[0]?.timeout
  // 596h and the setup step each fit a timer; with the harness's start allowance they don't.
  assert.equal(plan('596h'), 2 ** 31 - 1)
  assert.equal(plan('1h'), 3_600_000 + 1_800_000 + 2 * 90_000 + 5_000)
})

test('the tree and the collected tests fit their JSON Schemas in schema/plan/', async () => {
  const schema = (name: string) =>
    JSON.parse(readFileSync(new URL(`../schema/plan/${name}.schema.json`, import.meta.url), 'utf8'))
  const files: { file: string; tests: unknown[] }[] = Object.values(await all())
  files.push(
    await collected(tempDir('schemas-grouped'), () =>
      declareTree(groupedTree(), () => async () => {}),
    ),
  )
  for (const { file } of files) {
    const tree = JSON.parse(JSON.stringify(declaredTree(file)))
    assert.deepEqual(validate(schema('declaration'), tree), [], file)
  }
  const wire = files
    .flatMap(({ tests }) => tests)
    .map(({ index, name, groups, mode, options }) => ({
      index,
      name,
      groups,
      mode,
      ...(options.trial ? { trial: options.trial } : {}),
    }))
  for (const test of JSON.parse(JSON.stringify(wire)))
    assert.deepEqual(validate(schema('wire-test'), test), [], test.name)
  // The canary: a tree the schema rules out.
  assert.notDeepEqual(validate(schema('declaration'), { children: [{ type: 'eval' }] }), [])
  const family = { name: 'case', case: 0.5, cases: 2 }
  const fractional = {
    type: 'eval',
    name: 'e',
    mode: 'run',
    options: {},
    body: 'b',
    source: { body: '0'.repeat(64) },
    family,
  }
  assert.deepEqual(validate(schema('declaration'), { children: [fractional] }), [
    'children[0].family.case: expected a whole number, got 0.5',
  ])
})
