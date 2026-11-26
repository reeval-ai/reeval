// The conformance goldens in test/conformance/ (see its README), run against the real code. A
// declare/ case's TypeScript eval file must record its expected.json, and that tree, declared in
// place of the file, must plan the plan case's existing snapshot. A context/ script's requests go
// to reeval's attempt host on a real attempt through the reference runner (conformance/runner.ts),
// and reeval's answers and the attempt's record must be the script's.
// Every message fits the attempt protocol's Zod schemas and its JSON Schema.
// REEVAL_UPDATE_SNAPSHOTS=1 rewrites the goldens; review the diff.
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
import { basename, dirname, join, relative } from 'node:path'
import { before, describe, test } from 'node:test'
import { createJiti } from 'jiti'
import { biome } from '../scripts/schema/check.ts'
import type { ShapeSchema } from '../scripts/schema/generate.ts'
import { validate } from '../scripts/schema/validate.ts'
import { resolveConfig } from '../src/config.ts'
import {
  attemptAbortSchema,
  attemptDoneProblem,
  attemptReplySchema,
  attemptRequestProblem,
  attemptStartProblem,
} from '../src/contract/attempt.ts'
import { declarationProblem } from '../src/contract/declaration.ts'
import type { DeclarationTree, DeclaredNode } from '../src/declaration.ts'
import { collect, collectingFile, registerGroup, registerTest } from '../src/engine/collector.ts'
import { useEngine } from '../src/engine/runtime.ts'
import { declaredBody, declaredTree, resetDeclarationCollector } from '../src/evaluate.ts'
import { jitiTransform } from '../src/jiti.ts'
import type { RunContext } from '../src/types.ts'
import { project, readRun, runCli } from './helpers.ts'
import { testDir } from './support/fixture.ts'
import { matchFile, planJson, renderPlan } from './support/plan.ts'

const conformance = join(testDir, 'conformance')

const schema = (path: string): ShapeSchema =>
  JSON.parse(readFileSync(new URL(`../schema/${path}.schema.json`, import.meta.url), 'utf8'))

/** Compares with the golden at `test/<path>`; REEVAL_UPDATE_SNAPSHOTS=1 writes it, as Biome formats it. */
function matchJson(path: string, value: unknown): void {
  const file = join(testDir, path)
  if (process.env.REEVAL_UPDATE_SNAPSHOTS === '1') {
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
    const r = biome(['format', '--write', file])
    assert.equal(r.status, 0, r.stderr + r.stdout)
    return
  }
  assert.ok(existsSync(file), `No golden at test/${path}. Write it with REEVAL_UPDATE_SNAPSHOTS=1.`)
  const golden = JSON.parse(readFileSync(file, 'utf8'))
  assert.deepEqual(value, golden, `test/${path} (REEVAL_UPDATE_SNAPSHOTS=1 rewrites it)`)
}

type DeclareCase = {
  name: string
  eval: string
  plan: string
  args: string[]
  /** Plan directory for loading a declare mirror; defaults from `eval`. */
  treeRoot?: string
  /** Eval sources for the records test; defaults to the declare mirror. */
  sources?: string[]
  /** Plan eval files to copy; defaults to everything `eval` resolves. */
  planSources?: string[]
}

const declareCases: DeclareCase[] = readdirSync(join(conformance, 'declare'))
  .sort()
  .map((name) => ({
    name,
    ...JSON.parse(readFileSync(join(conformance, 'declare', name, 'case.json'), 'utf8')),
  }))

const evaluateModule = await import('../src/evaluate.ts')
const environmentModule = await import('../src/environment.ts')
const egressModule = await import('../src/egress.ts')

/** reeval's own modules, so an eval file loaded here declares into this process's collector. */
const virtualModules = {
  reeval: await import('../src/index.ts'),
  'reeval/legacy': {
    evaluate: evaluateModule.evaluate,
    group: evaluateModule.group,
    defineEnvironment: environmentModule.defineEnvironment,
    DEFAULT_EGRESS_ALLOW: egressModule.DEFAULT_EGRESS_ALLOW,
  },
  'reeval/agent': await import('../src/agent.ts'),
  'reeval/sandbox': await import('../src/sandbox.ts'),
  'reeval/judge': await import('../src/judge.ts'),
  'reeval/gateway': await import('../src/gateway.ts'),
}

/** Body ids count up across the files this process collects; a worker's start at b1. */
function renumbered(nodes: DeclaredNode[], from: number): DeclaredNode[] {
  return nodes.map((node) =>
    node.type === 'eval'
      ? { ...node, body: `b${Number(node.body.slice(1)) - from}` }
      : node.type === 'group'
        ? { ...node, children: renumbered(node.children, from) }
        : node,
  )
}

function listEvals(dir: string): string[] {
  const out: string[] = []
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) out.push(...listEvals(p))
    else if (ent.name.endsWith('.eval.ts')) out.push(p)
  }
  return out.sort()
}

function declareMirror(caseName: string) {
  return join(conformance, 'declare', caseName, 'mirror.eval.ts')
}

/** Eval file paths for a plan case's eval (one file, a split directory, or an evals tree). */
function evalSources(path: string, extra?: string[]): string[] {
  if (extra?.length) return extra.map((p) => join(testDir, p)).sort()
  const abs = join(testDir, path)
  if (path.endsWith('.eval.ts')) {
    if (existsSync(abs)) return [abs]
    const dir = abs.replace(/\.eval\.ts$/, '')
    if (existsSync(dir)) return listEvals(dir)
    throw new Error(`Missing eval source ${path}`)
  }
  if (existsSync(abs)) return listEvals(abs)
  throw new Error(`Missing eval source ${path}`)
}

function planRootOf(path: string) {
  return join(testDir, path.replace(/\/evals(?:\/[^/]+)?$/, ''))
}

function declareSources(c: DeclareCase): string[] {
  const mirror = declareMirror(c.name)
  if (c.sources?.length) return evalSources('', c.sources)
  if (existsSync(mirror)) return [mirror]
  return evalSources(c.eval)
}

function planEvalsDir(path: string) {
  if (path.endsWith('.eval.ts')) return join(testDir, dirname(path))
  const abs = join(testDir, path)
  const parent = dirname(abs)
  if (parent.endsWith('/evals') && basename(abs) !== 'evals') return parent
  return abs
}

function planFilterArg(path: string, sources: string[]) {
  const planEvals = planEvalsDir(path)
  if (sources.length === 1) return `evals/${relative(planEvals, sources[0]!)}`
  const abs = join(testDir, path)
  const parent = dirname(abs)
  if (parent.endsWith('/evals') && basename(abs) !== 'evals') return `evals/${basename(abs)}`
  if (!path.endsWith('.eval.ts')) return 'evals'
  return `evals/${basename(dirname(sources[0]!))}`
}

function installPlanEvals(root: string, c: DeclareCase) {
  const planEvals = planEvalsDir(c.eval)
  const destRoot = join(root, 'evals')
  rmSync(destRoot, { recursive: true, force: true })
  for (const src of evalSources(c.eval, c.planSources)) {
    const rel = relative(planEvals, src)
    const dest = join(destRoot, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(src, dest)
  }
  for (const ent of readdirSync(planEvals, { withFileTypes: true })) {
    if (!ent.isFile() || ent.name.endsWith('.eval.ts')) continue
    if (!/\.tsx?$/.test(ent.name)) continue
    cpSync(join(planEvals, ent.name), join(destRoot, ent.name))
  }
}

/** The tree defineEval records for a plan case's eval sources, as a worker collects them. */
async function treeOf(c: DeclareCase): Promise<DeclarationTree> {
  resetDeclarationCollector()
  const sources = declareSources(c)
  const planRoot = join(testDir, c.treeRoot ?? planRootOf(c.eval))
  const jiti = createJiti(planRoot, {
    transform: jitiTransform,
    virtualModules,
    moduleCache: false,
  })
  const config = (await jiti.import(join(planRoot, 'reeval.config.ts'), { default: true })) as never
  const run: RunContext = {
    runId: 'conformance',
    stagingDir: planRoot,
    config: resolveConfig(config, planRoot),
    tags: [],
    concurrency: 4,
    profile: null,
  }
  useEngine({
    registerTest,
    registerGroup,
    getRunContext: () => run,
    collectingFile,
    declarePlanned: () => {},
  })
  let before = 0
  while (declaredBody(`b${before + 1}`)) before++
  const children: DeclaredNode[] = []
  for (const file of sources) {
    await collect(file, () => jiti.import(file))
    const tree = declaredTree(file)
    assert.ok(tree, `${relative(testDir, file)} declared nothing`)
    children.push(...tree.children)
  }
  return JSON.parse(JSON.stringify({ children: renumbered(children, before) }))
}

describe('declare goldens', () => {
  for (const c of declareCases) {
    test(`${c.name}: ${c.eval} records expected.json`, async () => {
      const tree = await treeOf(c)
      assert.equal(declarationProblem(tree.children), undefined)
      assert.deepEqual(validate(schema('plan/declaration'), tree), [])
      matchJson(`conformance/declare/${c.name}/expected.json`, tree)
    })
  }
  for (const c of declareCases) {
    test(`${c.name}: expected.json, declared in its place, plans ${c.plan}`, async () => {
      const [, dir = ''] = c.eval.split('/')
      const installed = evalSources(c.eval, c.planSources)
      const planArgs = c.args.length ? c.args : [planFilterArg(c.eval, installed)]
      const plan = await planJson({
        dir,
        args: planArgs,
        prepare: (root) => installPlanEvals(root, c),
      })
      assert.equal(
        renderPlan(plan),
        readFileSync(join(testDir, c.plan), 'utf8'),
        `test/${c.plan}, from the declared tree`,
      )
    })
  }
})

type Line = {
  case?: string
  about?: string
  options?: Record<string, unknown>
  runner?: Record<string, unknown>
  reeval?: Record<string, unknown>
  record?: Record<string, unknown>
}

const contextCases = readdirSync(join(conformance, 'context'))
  .filter((f) => f.endsWith('.ndjson'))
  .sort()
  .map((f) => f.slice(0, -'.ndjson'.length))

const scriptPath = (name: string) => join(conformance, 'context', `${name}.ndjson`)

const parse = (text: string): Line[] =>
  text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Line)

const readScript = (name: string) => parse(readFileSync(scriptPath(name), 'utf8'))

const TIME = '2026-01-01T00:00:00.000Z'

/** Timestamps, durations and the project's path vary by run; the goldens hold them fixed. */
function steady(value: unknown, root: string): unknown {
  if (typeof value === 'string') return value.replaceAll(root, '<project>')
  if (Array.isArray(value)) return value.map((v) => steady(v, root))
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key,
      (key === 'startedAt' || key === 'ts' || key === 'timestamp') && typeof v === 'string'
        ? TIME
        : (key === 'durationMs' || key === 'atMs') && typeof v === 'number'
          ? 0
          : steady(v, root),
    ]),
  )
}

const CONFIG = `import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeJudge } from 'reeval/judge'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({
    files: { 'greet.js': 'export const greet = (name) => \`Hello, \${name}!\`\\n' },
    text: 'Wrote greet.js.',
  }),
  sandbox: fakeSandbox({ dir: new URL('./sandboxes', import.meta.url) }),
  judge: { model: fakeJudge({ score: 0.9 }) },
})
`

/** One eval per script, each the only one in its file, so its body is b1. */
const evalFile = (name: string, options: unknown, out: string) => {
  const run = { script: scriptPath(name), out, file: `evals/${name}.eval.ts`, body: 'b1' }
  const extra =
    options && typeof options === 'object' && Object.keys(options as object).length > 0
      ? `${Object.entries(options as Record<string, unknown>)
          .map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`)
          .join('\n')}\n`
      : ''
  return `import { defineEval } from 'reeval'
import { runScript } from './runner.ts'

const run = ${JSON.stringify(run)}

export default defineEval({
${extra}  async task(c) {
    await runScript(c, run)
  },
})
`
}

/** What reeval and the runner said, with the attempt's record from the run record. */
const answered = new Map<string, Line[]>()

function checkMessage(line: Line, where: string, requests: Map<string, string>): void {
  const reply = schema('protocol/attempt-reply')
  if (line.runner) {
    const m = line.runner
    if (m.type === 'done') {
      assert.equal(attemptDoneProblem(m), undefined, where)
      assert.deepEqual(validate(schema('protocol/attempt-done'), m), [], where)
      return
    }
    assert.equal(attemptRequestProblem(m), undefined, where)
    assert.deepEqual(validate(schema('protocol/attempt-request'), m), [], where)
    const id = m.id as string
    assert.ok(!requests.has(id), `${where}: request id ${id} is used twice`)
    requests.set(id, (m.call as { op: string }).op)
  } else if (line.reeval) {
    const m = line.reeval
    if (m.type === 'start') {
      assert.equal(attemptStartProblem(m), undefined, where)
      assert.deepEqual(validate(schema('protocol/attempt-start'), m), [], where)
    } else if (m.type === 'abort') {
      assert.ok(attemptAbortSchema.safeParse(m).success, where)
      assert.deepEqual(validate(schema('protocol/attempt-abort'), m), [], where)
    } else {
      const parsed = attemptReplySchema.safeParse(m)
      assert.ok(parsed.success, `${where}: ${JSON.stringify(parsed.error?.issues[0])}`)
      assert.deepEqual(validate(reply, m), [], where)
      assert.equal(requests.get(m.id as string), m.op, `${where}: answers request ${m.id}`)
    }
  } else
    assert.ok(line.case || line.record, `${where}: a line is a header, runner, reeval or record`)
}

describe('context goldens', () => {
  before(async () => {
    const files: Record<string, string> = { 'reeval.config.ts': CONFIG }
    const p = await project('conformance', files)
    cpSync(join(conformance, 'runner.ts'), join(p.dir, 'evals/runner.ts'))
    const outs = new Map(contextCases.map((name) => [name, join(p.dir, `${name}.out.ndjson`)]))
    for (const name of contextCases) {
      const [header] = readScript(name)
      writeFileSync(
        join(p.dir, `evals/${name}.eval.ts`),
        evalFile(name, header?.options ?? {}, outs.get(name) as string),
      )
    }
    const r = await runCli(p.dir, ['run'])
    assert.ok(r.code === 0 || r.code === 1, r.stdout + r.stderr)
    const { evals } = readRun(p.dir)
    for (const name of contextCases) {
      const out = outs.get(name) as string
      assert.ok(existsSync(out), `${name}: the runner wrote nothing\n${r.stdout}${r.stderr}`)
      const entry = evals.find((e) => e.id === name || e.name === name)
      assert.ok(entry, `${name}: no eval in the run record`)
      const { outcome, error, checks, observations } = entry.trial
      const lines = parse(readFileSync(out, 'utf8'))
      lines.push({
        record: {
          outcome,
          error,
          checks: checks.map(({ command, exitCode, retries, tries }) => ({
            command,
            exitCode,
            ...(retries ? { retries, tries: tries?.map((t) => ({ exitCode: t.exitCode })) } : {}),
          })),
          ...(observations ? { observations } : {}),
        },
      })
      answered.set(
        name,
        lines.map((line) => steady(line, p.dir) as Line),
      )
    }
  })

  for (const name of contextCases) {
    test(`${name}: reeval answers as the script says, in the protocol's shapes`, () => {
      const actual = answered.get(name)
      assert.ok(actual)
      const requests = new Map<string, string>()
      for (const [i, line] of actual.entries())
        checkMessage(line, `${name}.ndjson:${i + 1}`, requests)
      matchFile(
        `conformance/context/${name}.ndjson`,
        actual.map((line) => `${JSON.stringify(line)}\n`).join(''),
      )
    })
  }

  test('the scripts cover every call, background, an error reply and the lifecycle', () => {
    const lines = contextCases.flatMap(readScript)
    const calls = lines.flatMap((l) =>
      l.runner?.call ? [l.runner.call as Record<string, unknown>] : [],
    )
    const ops = new Set(calls.map((c) => c.op))
    for (const op of ['send', 'exec', 'kill', 'readFile', 'writeFile', 'observe', 'decide'])
      assert.ok(ops.has(op), op)
    assert.ok(calls.some((c) => c.op === 'exec' && c.background))
    assert.ok(calls.some((c) => c.op === 'writeFile' && c.encoding === 'base64'))
    assert.ok(lines.some((l) => l.reeval?.ok === false))
    for (const type of ['start', 'abort'])
      assert.ok(
        lines.some((l) => l.reeval?.type === type),
        type,
      )
    assert.ok(lines.some((l) => l.runner?.type === 'done' && l.runner.error))
  })

  test('the canary: a request with a key the protocol lacks is refused, naming it', () => {
    const request = { id: '1', call: { op: 'readFile', path: 'a.txt', encoding: 'utf8' } }
    assert.match(attemptRequestProblem(request) ?? '', /unknown key "encoding"/)
    assert.throws(() => checkMessage({ runner: request }, 'canary', new Map()))
  })
})
