// Smoke-tests a compiled reeval on the machine it was built for, with nothing installed: no
// node_modules, no dist/, only Node's built-ins to drive it. binary.yml runs it on each OS.
//
//   node scripts/binary-smoke.mjs <binary> [--docker]
//
// From an empty directory it checks `reeval --version` against packages/reeval/package.json, then
// plans and runs a copy of examples/with-skill-lift, and plans one whose config captures a stack
// on an object that isn't an Error. Then it serves that run with `reeval studio`, pairs with it as
// the hosted page would and fetches the run's view. It bundles a project with each JavaScript
// lockfile and runs the bundle with no package manager, so the binary installs as Bun. With
// --docker it builds the sandbox image with the binary and runs one egress fixture in Docker,
// whose eval passes and canary fails.
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
 * Bundles a workspace with each JavaScript lockfile at its git root and runs the bundle with the
 * package managers shadowed by commands that fail: the binary installs from every lockfile as Bun
 * itself. A member renamed since a bun.lock must fail the frozen install, so the install is Bun's.
 */
function bunInstall() {
  const shadow = join(alone, 'shadow')
  mkdirSync(shadow)
  for (const tool of ['bun', 'node', 'npm', 'pnpm', 'yarn']) {
    writeFileSync(join(shadow, tool), `#!/bin/sh\necho "smoke: ${tool} ran" >&2\nexit 127\n`)
    chmodSync(join(shadow, tool), 0o755)
    writeFileSync(join(shadow, `${tool}.cmd`), `@echo smoke: ${tool} ran 1>&2\r\n@exit /b 127\r\n`)
  }
  const path = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
  const env = { [path]: `${shadow}${delimiter}${process.env[path] ?? ''}` }
  const root = { name: 'repo', private: true, workspaces: ['apps/*'] }
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`
  const bunLock = (member) =>
    json({
      lockfileVersion: 1,
      workspaces: { '': { name: 'repo' }, 'apps/evals': { name: member } },
      packages: { [member]: [`${member}@workspace:apps/evals`] },
    })
  const cases = [
    { name: 'bun.lock', files: { 'bun.lock': bunLock('evals') } },
    {
      name: 'package-lock.json',
      files: {
        'package-lock.json': json({
          name: 'repo',
          lockfileVersion: 3,
          requires: true,
          packages: {
            '': { name: 'repo', workspaces: ['apps/*'] },
            'apps/evals': { version: '1.0.0' },
            'node_modules/evals': { resolved: 'apps/evals', link: true },
          },
        }),
      },
    },
    {
      name: 'pnpm-lock.yaml',
      files: {
        'package.json': json({ name: 'repo', private: true }),
        'pnpm-workspace.yaml': 'packages:\n  - apps/*\n',
        'pnpm-lock.yaml': [
          "lockfileVersion: '9.0'",
          '',
          'settings:',
          '  autoInstallPeers: true',
          '  excludeLinksFromLockfile: false',
          '',
          'importers:',
          '',
          '  .: {}',
          '',
          '  apps/evals: {}',
          '',
        ].join('\n'),
      },
    },
    {
      name: 'yarn.lock',
      files: {
        'yarn.lock':
          '# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n# yarn lockfile v1\n\n\n',
      },
    },
    {
      name: 'yarn.lock (Berry)',
      files: {
        'yarn.lock': [
          '__metadata:',
          '  version: 8',
          '  cacheKey: 10c0',
          '',
          '"evals@workspace:apps/evals":',
          '  version: 0.0.0-use.local',
          '  resolution: "evals@workspace:apps/evals"',
          '  languageName: unknown',
          '  linkType: soft',
          '',
          '"repo@workspace:.":',
          '  version: 0.0.0-use.local',
          '  resolution: "repo@workspace:."',
          '  languageName: unknown',
          '  linkType: soft',
          '',
        ].join('\n'),
      },
    },
    { name: 'a stale bun.lock', files: { 'bun.lock': bunLock('renamed') } },
  ]
  for (const [i, { name, files }] of cases.entries()) {
    const repo = join(alone, `lockfile-${i}`)
    const app = join(repo, 'apps/evals')
    mkdirSync(join(app, 'evals'), { recursive: true })
    const all = {
      'package.json': json(root),
      'apps/evals/package.json': json({ name: 'evals', version: '1.0.0', private: true }),
      '.gitignore': 'node_modules\n.reeval\nsandboxes\n',
      'apps/evals/reeval.config.ts': [
        "import { defineConfig } from 'reeval'",
        "import { fakeHarness } from 'reeval/harness'",
        "import { fakeSandbox } from 'reeval/sandbox'",
        'export default defineConfig({',
        "  harnesses: fakeHarness({ script: [[{ reply: 'hi' }]] }),",
        "  sandbox: fakeSandbox({ dir: new URL('./sandboxes', import.meta.url) }),",
        '})',
        '',
      ].join('\n'),
      'apps/evals/evals/hi.eval.ts': [
        "import { evaluate, expect } from 'reeval'",
        "evaluate('hi', async (c) => expect((await c.send('Say hi')).text).toBe('hi'))",
        '',
      ].join('\n'),
      ...files,
    }
    for (const [file, text] of Object.entries(all)) writeFileSync(join(repo, file), text)
    const git = (...args) => {
      const g = spawnSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true })
      if (g.status !== 0) throw new Error(`git ${args.join(' ')}: ${g.stderr || g.error}`)
    }
    git('init', '-q')
    git('add', '.')
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init')
    const out = join(repo, 'bundle.tar.gz')
    const made = reeval(app, ['bundle', '--out', out], env)
    const fresh = join(repo, 'fresh')
    mkdirSync(fresh)
    const r = reeval(fresh, ['run', '--bundle', out], env)
    const lockfile = Object.keys(files).find((f) => /lock/.test(f))
    const installed = r.out.includes(
      `installing from ${lockfile}: bun install --frozen-lockfile (this reeval's Bun `,
    )
    if (name.startsWith('a stale')) {
      check(
        "a stale bun.lock fails the bundle's frozen install",
        made.status === 0 && installed && r.status !== 0 && /lockfile is frozen/.test(r.out),
      )
    } else {
      check(
        `reeval run --bundle installs from ${name} as Bun, with no package manager`,
        made.status === 0 && installed && r.status === 0 && outcome(r) === '1 passed',
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
