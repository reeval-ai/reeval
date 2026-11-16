// Smoke-tests a compiled reeval on the machine it was built for, with nothing installed: no
// node_modules, no dist/, only Node's built-ins to drive it. binary.yml runs it on each OS.
//
//   node scripts/binary-smoke.mjs <binary> [--docker]
//
// From an empty directory it checks `reeval --version` against packages/reeval/package.json, then
// plans and runs a copy of examples/with-skill-lift, and plans one whose config captures a stack
// on an object that isn't an Error. Then it serves that run with `reeval studio`,
// pairs with it as the hosted page would and fetches the run's view. It bundles a project with a
// bun.lock and runs the bundle with no bun on PATH, so the binary installs as Bun. With --docker it builds the sandbox image
// with the binary and runs one egress fixture in Docker, whose eval passes and canary fails.
import { spawn, spawnSync } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, delimiter, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, stripVTControlCharacters } from 'node:util'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { docker: { type: 'boolean', default: false } },
})
if (positionals.length !== 1) {
  console.error('usage: node scripts/binary-smoke.mjs <binary> [--docker]')
  process.exit(2)
}
const root = fileURLToPath(new URL('..', import.meta.url))
const { version } = JSON.parse(readFileSync(join(root, 'packages/reeval/package.json'), 'utf8'))

const alone = mkdtempSync(join(tmpdir(), 'reeval-smoke-'))
const binary = join(alone, basename(positionals[0]))
cpSync(resolve(positionals[0]), binary)
chmodSync(binary, 0o755)
const cache = join(alone, 'cache')
const cacheEnv = { XDG_CACHE_HOME: cache, LOCALAPPDATA: cache }

/** A copy of `dir` in `alone`, without node_modules or .reeval. */
function project(dir, name) {
  const copy = join(alone, name)
  cpSync(dir, copy, {
    recursive: true,
    filter: (src) => !/[/\\](node_modules|\.reeval)([/\\]|$)/.test(src.slice(dir.length)),
  })
  // An example imports the shared ../profiles.ts; a copy takes its own, as the README says.
  const profiles = join(dir, '../profiles.ts')
  if (existsSync(profiles)) {
    cpSync(profiles, join(copy, 'profiles.ts'))
    const config = join(copy, 'reeval.config.ts')
    writeFileSync(
      config,
      readFileSync(config, 'utf8').replace("'../profiles.ts'", "'./profiles.ts'"),
    )
  }
  return copy
}

/** Runs the binary in `cwd`, printing its output as it would appear in a terminal. */
function reeval(cwd, args, env = {}) {
  const started = performance.now()
  const r = spawnSync(binary, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, ...cacheEnv, ...env },
  })
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  console.log(`\n$ reeval ${args.join(' ')}  (exit ${r.status}, ${seconds}s)`)
  const out = `${r.stdout}${r.stderr}`.trimEnd()
  console.log(args.includes('--json') ? `${out.slice(0, 300)}…` : out)
  return { ...r, out }
}
/** The tally on the run's `Done in …` line, e.g. `16 passed` or `1 failed · 1 passed`. */
const outcome = (r) =>
  stripVTControlCharacters(r.out)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('Done in '))
    .at(-1)
    ?.replace(/^Done in [^·]+· /, '')

const failures = []
const check = (name, ok) => {
  if (!ok) failures.push(name)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
}

const v = reeval(alone, ['--version'])
check(`reeval --version is ${version}`, v.status === 0 && v.stdout.trim() === version)

const example = project(join(root, 'examples/with-skill-lift'), 'example')
const plan = reeval(example, ['run', '--dry-run', '--json'])
let evals = 0
try {
  evals = JSON.parse(plan.stdout).evals.length
} catch {}
check(`the example plans (${evals} evals)`, plan.status === 0 && evals > 0)
const run = reeval(example, ['run'])
check('the example runs', run.status === 0 && /^\d+ passed$/.test(outcome(run) ?? ''))

// follow-redirects, under @daytona/sdk, calls Error.captureStackTrace on an object that isn't an
// Error, which Bun refuses while Babel's Error.prepareStackTrace hook is installed.
const capture = project(join(root, 'examples/with-skill-lift'), 'capture')
const captureConfig = join(capture, 'reeval.config.ts')
writeFileSync(
  captureConfig,
  `function Custom(this: object) { Error.captureStackTrace(this, Custom) }
Custom.prototype = new Error()
new (Custom as unknown as new () => object)()
${readFileSync(captureConfig, 'utf8')}`,
)
const captured = reeval(capture, ['run', '--dry-run'])
check('a config can capture a stack on a non-Error', captured.status === 0)

await serveStudio(example)
bunInstall()

if (values.docker) {
  const fixture = project(
    join(root, 'packages/reeval/test/features/egress/blocked-host-recorded'),
    'docker',
  )
  const env = { REEVAL_FIXTURE_SANDBOX: 'docker' }
  const image = reeval(fixture, ['image', 'build'], env)
  check('reeval image build', image.status === 0)
  const r = reeval(fixture, ['run'], env)
  check(
    'a Docker attempt behind the gateway',
    r.status === 1 && outcome(r) === '1 failed · 1 passed',
  )
}

rmSync(alone, { recursive: true, force: true, maxRetries: 5 })
if (failures.length) {
  console.error(`\nbinary-smoke: ${failures.length} failed: ${failures.join('; ')}`)
  process.exit(1)
}
console.log(`\nbinary-smoke: ${basename(binary)} ${version} works on its own`)

/**
 * Bundles a workspace whose bun.lock is at its git root and runs the bundle with no `bun` on PATH:
 * the binary installs from it as Bun itself. A member renamed since the lockfile must fail the
 * frozen install, so the install is really Bun's.
 */
function bunInstall() {
  const path = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
  const noBun = (process.env[path] ?? '')
    .split(delimiter)
    .filter((d) => !['bun', 'bun.exe'].some((b) => existsSync(join(d, b))))
    .join(delimiter)
  for (const member of ['evals', 'renamed']) {
    const repo = join(alone, `bun-${member}`)
    const app = join(repo, 'apps/evals')
    mkdirSync(join(app, 'evals'), { recursive: true })
    const files = {
      'package.json': { name: 'repo', private: true, workspaces: ['apps/*'] },
      'bun.lock': {
        lockfileVersion: 1,
        workspaces: { '': { name: 'repo' }, 'apps/evals': { name: 'evals' } },
        packages: { evals: ['evals@workspace:apps/evals'] },
      },
      'apps/evals/package.json': { name: member, private: true },
    }
    for (const [file, json] of Object.entries(files))
      writeFileSync(join(repo, file), `${JSON.stringify(json, null, 2)}\n`)
    writeFileSync(join(repo, '.gitignore'), 'node_modules\n.reeval\nsandboxes\n')
    writeFileSync(
      join(app, 'reeval.config.ts'),
      [
        "import { defineConfig } from 'reeval'",
        "import { fakeHarness } from 'reeval/harness'",
        "import { fakeSandbox } from 'reeval/sandbox'",
        'export default defineConfig({',
        "  harnesses: fakeHarness({ script: [[{ reply: 'hi' }]] }),",
        "  sandbox: fakeSandbox({ dir: new URL('./sandboxes', import.meta.url) }),",
        '})',
        '',
      ].join('\n'),
    )
    writeFileSync(
      join(app, 'evals/hi.eval.ts'),
      [
        "import { evaluate, expect } from 'reeval'",
        "evaluate('hi', async (c) => expect((await c.send('Say hi')).text).toBe('hi'))",
        '',
      ].join('\n'),
    )
    const git = (...args) => spawnSync('git', args, { cwd: repo, windowsHide: true })
    git('init', '-q')
    git('add', '.')
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init')
    const out = join(repo, 'bundle.tar.gz')
    const made = reeval(app, ['bundle', '--out', out], { [path]: noBun })
    const fresh = join(repo, 'fresh')
    mkdirSync(fresh)
    const r = reeval(fresh, ['run', '--bundle', out], { [path]: noBun })
    if (member === 'evals') {
      check(
        'reeval run --bundle installs from bun.lock as Bun, with no bun on PATH',
        made.status === 0 &&
          r.status === 0 &&
          r.out.includes(`installing from bun.lock: ${binary} install --frozen-lockfile`) &&
          outcome(r) === '1 passed',
      )
    } else {
      check(
        "a stale bun.lock fails the bundle's frozen install",
        made.status === 0 && r.status !== 0 && /lockfile is frozen/.test(r.out),
      )
    }
  }
}

/** Starts `reeval studio` in `cwd`, pairs with its token as the studio page does, then reads the runs. */
async function serveStudio(cwd) {
  const port = String(43000 + Math.floor(Math.random() * 2000))
  const origin = 'https://studio.example'
  const child = spawn(binary, ['studio', '--no-open', '--port', port], {
    cwd,
    windowsHide: true,
    env: { ...process.env, ...cacheEnv, REEVAL_CLOUD_URL: origin },
  })
  let out = ''
  child.stdout.on('data', (d) => {
    out += d
  })
  child.stderr.on('data', (d) => {
    out += d
  })
  try {
    const started = performance.now()
    let url
    while (!url && performance.now() - started < 30_000) {
      url = stripVTControlCharacters(out).match(/https?:\/\/\S+#t=\S+/)?.[0]
      if (!url) await new Promise((r) => setTimeout(r, 100))
    }
    console.log(`\n$ reeval studio --no-open --port ${port}`)
    console.log(
      stripVTControlCharacters(out)
        .replace(/#t=\S+/g, '#t=…')
        .trimEnd(),
    )
    if (!url) return check('reeval studio prints its pairing URL', false)
    const page = new URL(url)
    const server = page.searchParams.get('s')
    const token = new URLSearchParams(page.hash.slice(1)).get('t')
    const pair = await fetch(`${server}/api/v1/pair`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const { session } = pair.ok ? await pair.json() : {}
    check(
      `reeval studio pairs (${pair.status}, ${pair.headers.get('access-control-allow-origin')})`,
      pair.status === 200 && typeof session === 'string',
    )
    const get = async (path) => {
      const r = await fetch(`${server}${path}`, {
        headers: { origin, authorization: `Bearer ${session}` },
      })
      const body = await r.text()
      console.log(`GET ${path} → ${r.status} (${body.length} bytes)`)
      return { status: r.status, json: r.ok ? JSON.parse(body) : null }
    }
    const runs = await get('/api/v1/runs')
    const first = runs.json?.items?.[0]?.runId
    check(
      `reeval studio lists ${runs.json?.items?.length ?? 0} run`,
      runs.status === 200 && !!first,
    )
    if (!first) return
    const report = await get(`/api/v1/runs/${first}/report`)
    check(
      "reeval studio serves the run's report",
      report.status === 200 && report.json?.runId === first && report.json.evals.length > 0,
    )
  } finally {
    child.kill()
    await new Promise((r) => (child.exitCode === null ? child.once('exit', r) : r()))
  }
}
