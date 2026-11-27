// Verbosity and local debug data, through the real CLI on the fake sandbox: the `-v` phase trace
// and `-vv` payloads on screen, debug.log always in .reeval/debug and never in the history folder,
// trace.ndjson kept like a flight recorder (failures, or -vv), redaction in every output,
// retention and `reeval clean`. The Docker phases (image, container, gateway, docker commands) are
// in docker.test.ts.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { debugRoot } from '../src/debug/files.ts'
import { requestLine } from '../src/view/debug.ts'
import { fakeConfig, project, readRun, recordedRuns, runCli } from './helpers.ts'

/** Every file under `dir`, relative to it. */
function files(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name).slice(dir.length + 1))
    .sort()
}

/** The one trial directory of `name` (a substring of its eval slug) in the newest debug run. */
function trialDir(root: string, name: string): string {
  const runs = readdirSync(debugRoot(root)).sort()
  const run = join(debugRoot(root), runs.at(-1) as string)
  const matches = files(run)
    .filter((f) => f.endsWith('debug.log') && f.includes(name))
    .map((f) => join(run, f.slice(0, -'/debug.log'.length)))
  assert.equal(matches.length, 1, `one trial of ${name} in ${run}: ${files(run).join(', ')}`)
  return matches[0] as string
}

const read = (path: string) => readFileSync(path, 'utf8')

const script = "{ script: [[{ exec: 'echo from-the-agent' }, { write: { 'out.txt': 'hi\\n' } }]] }"
const passing = `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeSandbox } from 'reeval/sandbox'
const env = defineEnvironment('traced', {
  sandbox: fakeSandbox(),
  files: { 'notes.md': 'notes\\n' },
  setup: ['echo set-up > setup.txt'],
})
export default defineEval({
  environment: env,
  graders: [judge('Did it write out.txt?', { inputs: { diff: true } })],
  async task(c) {
    await c.send('write out.txt')
    assert.equal((await c.exec('test -f out.txt')).exitCode, 0)
  },
})
`
const failing = `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('write out.txt')
    assert.equal((await c.exec('test -f missing.txt')).exitCode, 0)
  },
})
`

/** `[traces#1 traced]  12:50:01 <phase>`: one trial's debug line for a phase. */
const phaseLine = (phase: string, ms = false) =>
  new RegExp(
    `^\\[traces#1 [^\\]]+\\]\\s+\\d{2}:\\d{2}:\\d{2}${ms ? '\\.\\d{3}' : ''} ${phase}\\s`,
    'm',
  )

const PHASES = ['plan', 'env', 'image', 'container', 'harness', 'check', 'judge', 'teardown']

describe('verbosity', () => {
  test('-v prints each phase line for a trial, prefixed with the trial', async () => {
    const p = await project('debug-v', {
      'reeval.config.ts': fakeConfig({ harness: script }),
      'evals/traces.eval.ts': passing,
    })
    const r = await runCli(p.dir, ['run', '-v'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    for (const phase of PHASES) assert.match(r.stdout, phaseLine(phase), phase)
    // What each phase says: the plan's sources, the files and setup placed, tool calls, the check.
    assert.match(
      r.stdout,
      / plan {6}config reeval\.config\.ts · no profile · run \S+ · trial fake\/traced\/fake#1$/m,
    )
    assert.match(r.stdout, / plan {6}environment traced \(evals\/traces\.eval\.ts\)$/m)
    assert.match(r.stdout, / env {7}file notes\.md \(6 bytes\)$/m)
    assert.match(r.stdout, / env {7}setup 1\/1 \$ echo set-up > setup\.txt → exit 0 · \d+m?s$/m)
    assert.match(r.stdout, / harness {3}tool shell called: \$ echo from-the-agent$/m)
    assert.match(r.stdout, / check {5}\$ test -f out\.txt → exit 0 · \d+m?s$/m)
    assert.match(r.stdout, / judge {5}fake · \d+m?s · true · P 0\.90$/m)
    assert.match(
      r.stdout,
      / teardown {2}record \.reeval\/runs\/\S+\.json · artifacts .* · debug \.reeval\/debug\//m,
    )
    // -v doesn't print -vv's payloads or millisecond times.
    assert.doesNotMatch(r.stdout, /resolved config|\d{2}:\d{2}:\d{2}\.\d{3}/)
  })

  test('canary: without -v, no phase line prints', async () => {
    const p = await project('debug-quiet', {
      'reeval.config.ts': fakeConfig({ harness: script }),
      'evals/traces.eval.ts': passing,
    })
    const r = await runCli(p.dir, ['run', '--output-logs', 'full'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    for (const phase of PHASES) assert.doesNotMatch(r.stdout, phaseLine(phase), phase)
    // Twin: the trial's own lines still print, under the same prefix.
    assert.match(r.stdout, /^\[traces#1 [^\]]+\] ▶ traces$/m)
  })

  test('grouped logs keep each trial’s debug lines in its own block', async () => {
    const p = await project('debug-grouped', {
      'reeval.config.ts': fakeConfig({ harness: script }),
      'evals/traces.eval.ts': passing,
      'evals/fails.eval.ts': failing,
    })
    const r = await runCli(p.dir, ['run', '-v', '--log-order', 'grouped'])
    assert.equal(r.code, 1, r.stdout + r.stderr)
    const lines = r.stdout.split('\n')
    for (const tag of ['[traces#1', '[fails#1']) {
      // Its start line prints at once; everything else is one block when it ends.
      const own = lines.flatMap((l, i) => (l.startsWith(tag) && !l.includes('▶') ? [i] : []))
      const debug = own.filter((i) => / \d{2}:\d{2}:\d{2} [a-z]+ /.test(lines[i] ?? ''))
      assert.ok(debug.length >= PHASES.length - 2, `${tag}: ${debug.length} debug lines`)
      const first = own[0] as number
      assert.deepEqual(
        own,
        own.map((_, i) => first + i),
        `${tag}'s block is contiguous`,
      )
    }
  })

  test('agent mode prints -v lines too, under the trial tag', async () => {
    const p = await project('debug-agent', {
      'reeval.config.ts': fakeConfig({ harness: script }),
      'evals/traces.eval.ts': passing,
    })
    const r = await runCli(p.dir, ['run', '-v'], { env: { REEVAL_UI: 'agent' } })
    assert.equal(r.code, 0, r.stdout + r.stderr)
    for (const phase of PHASES) assert.match(r.stdout, phaseLine(phase), phase)
    // Twin: agent mode's own output is still there, and nothing else of plain mode's.
    assert.match(r.stdout, /^Done in \S+ · 1 eval · 1 on target$/m)
    assert.doesNotMatch(r.stdout, /▶ evals\/a\.eval\.ts/)
  })

  test('-vv adds raw payloads with millisecond times', async () => {
    const p = await project('debug-vv', {
      'reeval.config.ts': fakeConfig({ harness: script }),
      'evals/traces.eval.ts': passing,
    })
    const r = await runCli(p.dir, ['run', '-vv'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    for (const phase of PHASES) assert.match(r.stdout, phaseLine(phase, true), phase)
    assert.match(r.stdout, / plan {6}resolved config\n\[[^\]]+\] {6}\{"config":\{"root":/)
    assert.match(r.stdout, / env {7}resolved environment\n/)
    assert.match(r.stdout, / harness {3}trajectory tool\n.*"output":"from-the-agent\\n"/)
    assert.match(r.stdout, / judge {5}judge prompt\n.*"question":"Did it write out\.txt\?"/)
    assert.match(r.stdout, / check {5}check output: test -f out\.txt\n/)
  })
})

describe('local debug data', () => {
  test('debug.log is always written to .reeval/debug, and nothing of it lands in the history', async () => {
    const p = await project('debug-log', {
      'reeval.config.ts': fakeConfig({ harness: script }),
      'evals/traces.eval.ts': passing,
    })
    const r = await runCli(p.dir, ['run', '--record'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const { run } = readRun(p.dir)
    const dir = trialDir(p.dir, 'traces-')
    assert.ok(dir.includes(join('.reeval', 'debug', run.runId)), dir)
    const log = read(join(dir, 'debug.log'))
    for (const phase of PHASES) {
      assert.match(log, new RegExp(`^\\d{4}-\\d{2}-\\d{2}T[\\d:.]+Z ${phase}\\s`, 'm'), phase)
    }
    assert.deepEqual(files(dir), ['debug.log'], 'a passing trial keeps no trace')

    const history = join(p.dir, 'evals', '.history')
    assert.deepEqual(recordedRuns(p.dir), [run.runId])
    const recorded = files(history)
    assert.ok(recorded.length > 1, 'twin: the history has the run and its artifacts')
    assert.deepEqual(
      recorded.filter((f) => /debug\.log|trace\.ndjson|requests\.ndjson|snapshots[\\/]/.test(f)),
      [],
    )
    for (const f of recorded) {
      assert.doesNotMatch(read(join(history, f)), /\.reeval\/debug|debug\.log/, f)
    }
  })

  test('trace.ndjson is kept for a failing trial, not a passing one unless -vv', async () => {
    const p = await project('debug-trace', {
      'reeval.config.ts': fakeConfig({ harness: script }),
      'evals/traces.eval.ts': passing,
      'evals/fails.eval.ts': failing,
    })
    const r = await runCli(p.dir, ['run'])
    assert.equal(r.code, 1, r.stdout + r.stderr)
    const pass = trialDir(p.dir, 'traces-')
    const fail = trialDir(p.dir, 'fails-')
    assert.equal(existsSync(join(pass, 'trace.ndjson')), false, 'no trace for the pass')
    const trace = read(join(fail, 'trace.ndjson'))
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
    assert.deepEqual(Object.keys(trace[0]), ['kind', 'startedAt', 'limitBytes', 'dropped'])
    assert.equal(trace[0].dropped, 0)
    const kinds = new Set(
      trace.slice(1).map((e: { phase: string; kind: string }) => `${e.phase}/${e.kind}`),
    )
    for (const kind of ['plan/config', 'env/environment', 'harness/trajectory', 'check/output']) {
      assert.ok(kinds.has(kind), `${kind} in ${[...kinds].join(', ')}`)
    }
    assert.ok(trace.slice(1).every((e: { ms: unknown }) => Number.isInteger(e.ms)))

    const traced = await runCli(p.dir, ['run', '-vv'])
    assert.equal(traced.code, 1, traced.stdout + traced.stderr)
    assert.ok(existsSync(join(trialDir(p.dir, 'traces-'), 'trace.ndjson')))
  })

  test('a small trace buffer drops the oldest entries and says how many', async () => {
    const p = await project('debug-buffer', {
      'reeval.config.ts': fakeConfig({
        harness: script,
        extra: 'debug: { traceBufferMb: 0.002 },',
      }),
      'evals/fails.eval.ts': failing,
    })
    const r = await runCli(p.dir, ['run'])
    assert.equal(r.code, 1, r.stdout + r.stderr)
    const text = read(join(trialDir(p.dir, 'fails-'), 'trace.ndjson'))
    const [head, ...entries] = text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
    assert.ok(head.dropped > 0, JSON.stringify(head))
    assert.ok(text.length < 4 * 2048, `${text.length} bytes`)
    // The newest entries survive: the teardown's.
    assert.equal(entries.at(-1).phase, 'teardown')
  })

  test('redaction holds on screen, in debug.log and in trace.ndjson, encoded forms included', async () => {
    const LEAKY = 'reeval dbg/7c+1d"9a&b?0=e4f'
    const forms = [
      LEAKY,
      Buffer.from(LEAKY).toString('base64'),
      encodeURIComponent(LEAKY),
      JSON.stringify(LEAKY).slice(1, -1),
    ]
    const leak = [
      'echo "$LEAKY"',
      `printf %s "$LEAKY" | base64`,
      `node -e 'console.log(encodeURIComponent(process.env.LEAKY))'`,
    ].join('; ')
    const p = await project('debug-redact', {
      'reeval.config.ts': fakeConfig({
        harness: `{ script: [[{ exec: ${JSON.stringify(leak)} }]] }`,
      })
        .replace('export default defineConfig({', 'export default defineConfig(({ secret }) => ({')
        .replace(/\}\)\n$/, '}))\n')
        .replace('judge:', "env: { LEAKY: secret.fromEnv('REEVAL_DEBUG_LEAKY') },\n  judge:"),
      'evals/leaks.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('print it')
    const r = await c.exec(${JSON.stringify(leak)})
    assert.equal(r.exitCode, 0)
  },
})
`,
    })
    const r = await runCli(p.dir, ['run', '-vv'], { env: { REEVAL_DEBUG_LEAKY: LEAKY } })
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const dir = trialDir(p.dir, 'leaks')
    const outputs = {
      screen: r.stdout + r.stderr,
      'debug.log': read(join(dir, 'debug.log')),
      'trace.ndjson': read(join(dir, 'trace.ndjson')),
    }
    for (const [where, text] of Object.entries(outputs)) {
      for (const form of forms) assert.equal(text.includes(form), false, `${where} has ${form}`)
    }
    // The canary: where the secret would be, [REDACTED] is, so the check can see a leak.
    assert.match(outputs.screen, /"output":"\[REDACTED\]\\n\[REDACTED\]\\n\[REDACTED\]\\n"/)
    assert.match(
      outputs['trace.ndjson'],
      /"stdout":"\[REDACTED\]\\n\[REDACTED\]\\n\[REDACTED\]\\n"/,
    )
    assert.match(outputs['debug.log'], /check +\$ echo "\$LEAKY"; .* → exit 0/)
  })

  test("a declared secret under a plain name is masked in an eval's logs and failures on screen", async () => {
    const DSN = 'dsn_7c1d9ab04e4f2a6b8c'
    const p = await project('debug-redact-declared', {
      'reeval.config.ts': fakeConfig(),
      'evals/b.eval.ts': `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
const env = defineEnvironment('sentry', ({ secret }) => ({
  sandbox: fakeSandbox(),
  env: { SENTRY_DSN: secret.fromEnv('REEVAL_DEBUG_DSN') },
}))
export default defineEval({
  environment: env,
  async task(c) {
    const dsn = (await c.exec('printenv SENTRY_DSN')).stdout.trim()
    console.log('logged', dsn)
    console.error('warned', dsn)
    assert.equal(dsn, 'wrong')
  },
})
`,
    })
    for (const ui of ['plain', 'agent']) {
      const r = await runCli(p.dir, ['run', '--ui', ui, '--output-logs', 'errors-only'], {
        env: { REEVAL_DEBUG_DSN: DSN },
      })
      assert.equal(r.code, 1, r.stdout + r.stderr)
      const screen = r.stdout + r.stderr
      for (const n of [DSN.length, 12, 8]) {
        assert.equal(
          screen.includes(DSN.slice(-n)),
          false,
          `${ui}: the screen has ${DSN.slice(-n)}`,
        )
      }
      // The canary: the failure is on screen with the value masked, so a leak would show.
      assert.match(screen, /\+ '\[REDACTED\]'/, `${ui}: ${screen}`)
      if (ui === 'plain') assert.match(screen, /stdout \| logged \[REDACTED\]/)
    }
  })

  test("a secret in an error that stops the run is masked, config's and an eval file's", async () => {
    const KEY = 'reeval-fatal-7c1d9ab04e4f2a6b8c9d0e'
    const p = await project('debug-redact-fatal', {
      'reeval.config.ts': fakeConfig().replace(
        'export default',
        `if (process.env.REEVAL_FATAL_WHERE === 'config') throw new Error('config refused ' + process.env.REEVAL_FATAL_API_KEY)\nexport default`,
      ),
      'evals/b.eval.ts': `import { defineEval } from 'reeval'
if (process.env.REEVAL_FATAL_WHERE === 'eval') throw new Error(\`eval refused \${process.env.REEVAL_FATAL_API_KEY}\`)
export default defineEval({ async task() {} })
`,
    })
    for (const where of ['config', 'eval']) {
      for (const debug of [{}, { REEVAL_DEBUG: '1' }]) {
        const r = await runCli(p.dir, ['run'], {
          env: { REEVAL_FATAL_WHERE: where, REEVAL_FATAL_API_KEY: KEY, ...debug },
        })
        const screen = r.stdout + r.stderr
        assert.equal(r.code, 2, screen)
        assert.equal(screen.includes(KEY.slice(-12)), false, `${where}: ${screen}`)
        // The canary: the error is on screen, with the key masked where it was.
        assert.match(screen, new RegExp(`${where} refused \\[REDACTED\\]`), screen)
      }
    }
  })

  test("a key's tail is masked on screen, in debug.log, trace.ndjson and the trajectory", async () => {
    const KEY = 'crsr_debug_7f3Kq9ZpL2mXw8Rt4VbN6yHc'
    const tail = KEY.slice(-12)
    // What a leak check that searches the sandbox for the key's tail would run and print.
    const search = `echo searching for ${tail}; grep -rlsF -e '${tail}' . || true`
    const p = await project('debug-redact-tail', {
      'reeval.config.ts': fakeConfig({
        harness: `{ script: [[{ exec: ${JSON.stringify(search)} }]] }`,
      }),
      'evals/searches.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('search')
    const tail = (process.env.REEVAL_DEBUG_PROVIDER_API_KEY ?? '').slice(-12)
    const r = await c.exec(\`echo searching for \${tail}; grep -rlsF -e '\${tail}' . || true\`)
    assert.equal(r.exitCode, 0)
  },
})
`,
    })
    const env = { REEVAL_DEBUG_PROVIDER_API_KEY: KEY }
    const r = await runCli(p.dir, ['run', '-vv'], { env })
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const dir = trialDir(p.dir, 'searches')
    const { run } = readRun(p.dir)
    const outputs = {
      screen: r.stdout + r.stderr,
      'debug.log': read(join(dir, 'debug.log')),
      'trace.ndjson': read(join(dir, 'trace.ndjson')),
      'the record and trajectory': JSON.stringify(run),
    }
    for (const [where, text] of Object.entries(outputs)) {
      for (const n of [8, 10, 12]) {
        const fragment = KEY.slice(-n)
        assert.equal(text.includes(fragment), false, `${where} has the key's last ${n}`)
      }
    }
    // The canary: the masked command is there, so the check would see the tail if it leaked.
    assert.match(outputs['debug.log'], /check +\$ echo searching for \[REDACTED\]; grep/)
    assert.match(outputs['the record and trajectory'], /searching for \[REDACTED\]/)
  })

  test('a credential-like MCP header written as a plain string is masked on screen, in the trace and the record', async () => {
    const AUTH = 'Bearer 5c4b3a29f8e7d6c5b4a3928170f6e5d4'
    const SOURCE = 'nightly-ci-9z8y7x6w'
    // The agent prints its MCP config, as a real agent can.
    const config = `Authorization: ${AUTH}\nX-Request-Source: ${SOURCE}\n`
    const p = await project('debug-redact-mcp-header', {
      'reeval.config.ts': fakeConfig({ harness: "{ script: [[{ exec: 'cat mcp-config.txt' }]] }" }),
      'evals/prints.eval.ts': `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
const env = defineEnvironment('headers', ({ mcp }) => ({
  sandbox: fakeSandbox(),
  files: { 'mcp-config.txt': ${JSON.stringify(config)} },
  mcp: {
    local: mcp.http('http://localhost:1/mcp', {
      headers: { Authorization: ${JSON.stringify(AUTH)}, 'X-Request-Source': ${JSON.stringify(SOURCE)} },
    }),
  },
}))
export default defineEval({
  environment: env,
  async task(c) {
    const turn = await c.send('print them')
    assert.equal(turn.text, 'Done.')
  },
})
`,
    })
    const r = await runCli(p.dir, ['run', '-vv'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const dir = trialDir(p.dir, 'prints')
    const view = readRun(p.dir)
    const outputs = {
      screen: r.stdout + r.stderr,
      'debug.log': read(join(dir, 'debug.log')),
      'trace.ndjson': read(join(dir, 'trace.ndjson')),
      'the record and trajectory': [
        JSON.stringify(view.run),
        ...files(view.dir).map((f) => read(join(view.dir, f))),
      ].join('\n'),
    }
    for (const [where, text] of Object.entries(outputs)) {
      for (const n of [AUTH.length, 32, 12]) {
        assert.equal(text.includes(AUTH.slice(-n)), false, `${where} has the header's last ${n}`)
      }
    }
    // The canary: the neutral header beside it is printed as it is, so a value would show.
    for (const where of ['screen', 'trace.ndjson', 'the record and trajectory'] as const) {
      assert.match(outputs[where], new RegExp(`X-Request-Source: ${SOURCE}`), where)
      assert.match(outputs[where], /Authorization: \[REDACTED\]/, where)
    }
    assert.match(outputs.screen, /mcp\.local\.headers\.Authorization is a plain string/)
    assert.equal(outputs.screen.includes('X-Request-Source is a plain string'), false)
  })

  test('keeps the newest debug.keep runs, and reeval clean clears them', async () => {
    const p = await project('debug-keep', {
      'reeval.config.ts': fakeConfig({ extra: 'debug: { keep: 2 },' }),
      'evals/a.eval.ts': `import { defineEval } from 'reeval'\nexport default defineEval({ async task(c) { await c.send('go') } })\n`,
    })
    const runs = () => (existsSync(debugRoot(p.dir)) ? readdirSync(debugRoot(p.dir)).sort() : [])
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      const r = await runCli(p.dir, ['run'])
      assert.equal(r.code, 0, r.stdout + r.stderr)
      ids.push(readRun(p.dir).run.runId)
      assert.equal(runs().length, Math.min(i + 1, 2), `after run ${i + 1}`)
    }
    assert.deepEqual(runs(), ids.slice(1), 'the oldest run went first')

    const some = await runCli(p.dir, ['clean', '--keep', '1'])
    assert.equal(some.code, 0, some.stderr)
    assert.match(
      some.stdout,
      /^Removed debug data and snapshots for 1 run \(\d+(\.\d)? [KM]?B\) from \.reeval\/debug and \.reeval\/runs$/m,
    )
    assert.deepEqual(runs(), ids.slice(2))
    const all = await runCli(p.dir, ['clean'])
    assert.match(all.stdout, /^Removed debug data and snapshots for 1 run /m)
    assert.deepEqual(runs(), [])
    assert.match(
      (await runCli(p.dir, ['clean'])).stdout,
      /^No debug data or snapshots to remove in \.reeval\/debug or \.reeval\/runs$/m,
    )
    assert.equal(readRun(p.dir).run.runId, ids[2], 'scratch runs are left alone')
    const bad = await runCli(p.dir, ['clean', '--keep', 'x'])
    assert.equal(bad.code, 2)
    assert.match(bad.stderr, /--keep must be a whole number \(got x\)/)
  })
})

test("the gateway line says a name that didn't resolve is unresolved, not blocked", () => {
  const base = {
    method: 'GET',
    host: 'metadata.google.internal',
    port: 80,
    via: 'http' as const,
    allowed: false,
    sent: 0,
    received: 0,
    substituted: [],
    ms: 3,
  }
  assert.equal(
    requestLine({
      ...base,
      url: 'http://metadata.google.internal:80/',
      status: 502,
      reason: "can't resolve metadata.google.internal: getaddrinfo ENOTFOUND",
      unresolved: true,
    }),
    "GET http://metadata.google.internal:80/ → 502 · unresolved: can't resolve metadata.google.internal: getaddrinfo ENOTFOUND · ↑0 B ↓0 B · 3ms · no key substituted",
  )
  assert.match(
    requestLine({
      ...base,
      host: '169.254.169.254',
      url: 'http://169.254.169.254:80/',
      status: 403,
      reason: '169.254.169.254 is a loopback or link-local address',
    }),
    / → 403 · blocked: 169\.254\.169\.254 is a loopback or link-local address · /,
  )
})
