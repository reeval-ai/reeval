// Tiers F, D and C: one directory per feature under test/features/, each with one check
// (evals/lands.eval.ts) and a canary that must fail (evals/canary.eval.ts). The same fixture runs on
// the fake sandbox, in Docker when Docker and reeval's image are there, in rootless Podman when
// Podman and its copy of the image are there, and on real Cursor with
// REEVAL_TEST_REAL=1 and CURSOR_API_KEY. The oracle here checks the record from outside; see
// test/features/README.md for adding one.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createSocket } from 'node:dgram'
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { networkInterfaces } from 'node:os'
import { delimiter, dirname, join, relative } from 'node:path'
import { after, before, describe, test } from 'node:test'
import { gunzipSync, gzipSync } from 'node:zlib'
import { ANTIGRAVITY_CLI_VERSION } from '@reeval/harness-antigravity'
import { CODEX_CLI_VERSION } from '@reeval/harness-codex'
import { FX_CLI_VERSION } from '@reeval/harness-fx'
import { GOOSE_CLI_VERSION } from '@reeval/harness-goose'
import { GROK_CLI_VERSION } from '@reeval/harness-grok-build'
import { OPENCODE_CLI_VERSION } from '@reeval/harness-opencode'
import { PI_CLI_VERSION } from '@reeval/harness-pi'
import {
  BAKED_HARNESSES,
  type BakedHarness,
  DEFAULT_IMAGE,
  imageFor,
  LABEL,
  readTar,
} from '@reeval/sandbox-docker'
import { openArchive } from '../src/archive/index.ts'
import { pngSize, stubPng } from '../src/capture/stub.ts'
import { hasFile, inDiff, notInDiff } from '../src/grade/builtins.ts'
import type { GradeInputs } from '../src/grade/context.ts'
import { type GraderDef, graderDef } from '../src/grade/define.ts'
import { judge } from '../src/grade/judge-grader.ts'
import { runGraders } from '../src/grade/run.ts'
import { fakeBrokering } from '../src/harness/agents.ts'
import { readStoredAttempt } from '../src/history/stored-attempt.ts'
import type { RunRecord } from '../src/history/types.ts'
import { sha256 } from '../src/ids.ts'
import { askJudge } from '../src/judge/index.ts'
import { fakeJudge } from '../src/judge.ts'
import { runLabels, runPrefix } from '../src/sandbox/boat.ts'
import { installId } from '../src/sandbox/id-part.ts'
import { vmPrefix } from '../src/sandbox/tart.ts'
import type { JSONValue } from '../src/types.ts'
import type { RunEventLine } from '../src/view/events.ts'
import type { SuiteResult } from '../src/view/suite.ts'
import { liveSandboxes, project, readRun, runCli, spawnTool } from './helpers.ts'
import { type FakeBoat, fakeBoat } from './support/boat.ts'
import { seedModelsDev } from './support/cost.ts'
import { type FakeDaytona, fakeDaytona } from './support/daytona.ts'
import {
  fakeDigest,
  fakeTart,
  fakeTartHosts,
  holdLoopback,
  LOOPBACK_WAIT_MS,
} from './support/fake-tart.ts'
import { fixture, testDir } from './support/fixture.ts'
import { type GitHttp, gitHttpServer } from './support/git-http.ts'
import {
  type HarnessRow,
  harnesses,
  harnessOf,
  keyOf,
  reserveAttempts,
} from './support/harnesses.ts'
import {
  boatSandbox as boat,
  createBoatSandbox as createBoat,
  createDaytonaSandbox as createDaytona,
  daytonaSandbox as daytona,
} from './support/machines.ts'
import { type EvalExpectation, expectRun, type RunExpectation } from './support/oracle.ts'
import { syncPythonFixtureProject } from './support/python-fixture.ts'
import { SEEDED_RUN_ID, writeStoppedStaging } from './support/resume.ts'
import {
  buildDaytonaImage,
  buildSshVmImage,
  DAYTONA_VM_SIZE,
  startBoatDockerVm,
  startDaytonaVm,
  startSshVm,
} from './support/ssh-vm.ts'
import { writeStudioResponses } from './support/studio.ts'
import { type FakeVmService, fakeVmService, VM_RUN_LABEL } from './support/vm-service.ts'

/**
 * `podman` is `podman()` where `docker` is `docker()`; `real` is Docker with real Cursor
 * (REEVAL_FIXTURE_HARNESS=cursor), one fixture at a time.
 */
type Tier = 'fake' | 'docker' | 'podman' | 'real'

type Feature = {
  /** Under `test/features/`. */
  dir: string
  tiers: Tier[]
  /** The environment the evals run in: attempt ids are `fake/<env>/<sandbox>#1`. */
  env: string
  /** Cell sandbox id, when it isn't the tier default (`fake`, `docker` or `podman`). */
  sandbox?: string
  /**
   * Cell environments in plan order, when an eval runs more than one (a compare).
   * Defaults to `[env]`.
   */
  cells?: string[]
  /** Canary cell environments in plan order. Defaults to `cells`, then `[canaryEnv ?? env]`. */
  canaryCells?: string[]
  /** What the canary's failure says: proof it failed on the check, not on setup. */
  canary: RegExp | ((tier: Tier) => RegExp)
  /**
   * What the canary's first failed attempt observed, by name: proof the check saw the wrong value
   * rather than nothing. See `sawMatches` for how each value matches.
   */
  canarySaw?: Record<string, Saw>
  /** What the canary's first failed attempt's graders returned, by grader name, matched as `canarySaw`. */
  canaryGraded?: Record<string, Saw> | ((tier: Tier) => Record<string, Saw>)
  /** The canary's environment, when it needs another one; defaults to `env`. */
  canaryEnv?: string
  /** Canary cell environments that must pass. The other canary attempts must match `canary`. */
  canaryPass?: string[]
  /** When the check is that the attempt fails, e.g. an infra error; else it must pass. */
  lands?: Pick<EvalExpectation, 'outcome' | 'error'>
  /** With `lands.error`, the cell environments whose attempts must pass instead. */
  landsPass?: string[]
  /**
   * Host variables for `reeval run`, e.g. what `secret.fromEnv` reads; a function runs at test time,
   * with the copied project's directory.
   */
  hostEnv?: NodeJS.ProcessEnv | ((dir: string) => NodeJS.ProcessEnv)
  /** Where `reeval run` starts, under the copied project; defaults to its root. */
  cwd?: string
  /** Runs on the copied project before `reeval run`. */
  prepare?: (dir: string) => void | Promise<void>
  /** Boots fake-tart VMs, so it holds the loopback their gateways share ({@link holdLoopback}). */
  loopback?: true
  /** Needs POSIX file modes on the host, so the fake tier skips on Windows. */
  posixModes?: true
  /** A host device the Docker tier passes in, so it skips on a host without one. */
  hostDevice?: string
  /**
   * Every eval and attempt, when the defaults can't name them: several harnesses or a family's
   * cases. Fake tier only, where the ids are fixed.
   */
  evals?: RunExpectation['evals']
  /** A host-side cross-check of the record, independent of the in-sandbox check. */
  record?: (view: {
    run: RunRecord
    project: string
    runDir: string
    tier: Tier
    /** What `reeval run` printed. */
    stdout: string
  }) => void | Promise<void>
  /** reeval's image the Docker and Podman tiers need, when it isn't Cursor's (a fake agent with `layout`). */
  image?: BakedHarness
  /**
   * The harness a parameterized fixture's fake agent mimics, as REEVAL_FIXTURE_LAYOUT: the
   * directory has one row per harness, named `<dir>:<layout>` (see {@link perHarness}).
   */
  layout?: BakedHarness
  /**
   * The harness the real tier runs it on, with that contract row's model and key, when it isn't
   * Cursor: a harness-specific behavior only that agent has.
   */
  realHarness?: HarnessRow['id']
  /**
   * `reeval run` bound for this fixture (node:test gets 10s more). Defaults: fake 60s,
   * docker 240s, real 600s.
   */
  timeoutMs?: Partial<Record<Tier, number>>
  /** Extra `reeval run` arguments, e.g. `--resume`. */
  args?: string[]
}

/** An eval's section in summary.md (RunReport `## {name}`). */
function blockOf(stdout: string, name: string): string {
  const lines = stdout.split('\n')
  const start = lines.findIndex((l) => new RegExp(`^## ${name}$`).test(l))
  assert.ok(start >= 0, `no block for ${name}\n${stdout}`)
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l))
  return lines.slice(start, end < 0 ? undefined : end).join('\n')
}

/** An eval's entry in `reeval run`'s status list, its row and detail lines, without the tree. */
function entryOf(stdout: string, name: string): string {
  const lines = stdout.split('\n')
  const row = new RegExp(`^\\s*(?:[├└]─ )?\\S+ ${name}  `)
  const start = lines.findIndex((l) => row.test(l))
  assert.ok(start >= 0, `no entry for ${name}\n${stdout}`)
  const end = lines.findIndex((l, i) => i > start && (!l.trim() || /^\s*[├└]─ /.test(l)))
  return lines
    .slice(start, end < 0 ? undefined : end)
    .map((l, i) => (i === 0 ? l.replace(/^\s*[├└]─ /, '') : l.replace(/^(?:│ {2}| {3})/, '')))
    .join('\n')
}

const studioSource = (project: string) => ({
  root: project,
  historyDir: join(project, 'evals', '.history'),
  scratch: false,
})
const TOKEN = 'reeval-fixture-token-7c1d9a0b52e4'
const AGENT_VALUE = 'reeval-fixture-agent-3f8e61b2a9d0'

/** Where a fixture's `REEVAL_SECRETS_FILE` is, in its project. */
const SECRETS_JSON = 'secrets.json'

/** Writes the fixture's `REEVAL_SECRETS_FILE` with `secrets`, and the variable naming it. */
function secretsFile(dir: string, secrets: Record<string, unknown>) {
  const file = join(dir, SECRETS_JSON)
  writeFileSync(file, JSON.stringify({ version: 1, secrets }))
  return { REEVAL_SECRETS_FILE: file }
}
/** A made-up OpenAI key: the gateway refuses the request before any key goes upstream. */
const BROKERED_KEY = 'sk-reeval-fixture-0b7e52c91d4a6f38'
/** With characters each encoding changes: space, `/`, `+`, `"`, `&`, `?` and `=`. */
const LEAKY = 'reeval leak/7c+1d"9a&b?0=e4f2'

/** Each way the redaction-coverage agent prints LEAKY, and each of those inside a JSON string. */
const leakyForms = () => {
  const printed = [
    LEAKY,
    Buffer.from(LEAKY).toString('base64'),
    encodeURIComponent(LEAKY),
    JSON.stringify(LEAKY).slice(1, -1),
  ]
  return [...new Set(printed.flatMap((f) => [f, JSON.stringify(f).slice(1, -1)]))]
}

/**
 * A listener on the host at an address that isn't loopback (the gateway never reaches loopback),
 * for the egress fixtures: `REEVAL_EGRESS_HOST` is its address, `REEVAL_EGRESS_TARGET` adds the port.
 */
const egressTarget = { host: '', port: 0, requests: 0 }
const listener = createServer((_, res) => {
  egressTarget.requests++
  res.end('reeval-egress-ok')
})

/**
 * A DNS server beside the listener that answers every A query with {@link DNS_ANSWER}, so a
 * fixture can tell whether a name resolves for the sandbox without depending on the machine's own
 * resolver (rootless Podman reaches its upstream through slirp4netns, which sometimes gets no
 * answer for a whole lookup). `REEVAL_EGRESS_DNS` is its address and port,
 * `REEVAL_EGRESS_DNS_ANSWER` the address it answers with.
 */
const DNS_ANSWER = [192, 0, 2, 1]
const dnsResponder = createSocket('udp4').on('message', (query, from) => {
  if (query.length < 12) return
  let end = 12
  while (end < query.length && query[end] !== 0) end += (query[end] ?? 0) + 1
  const question = query.subarray(12, end + 5)
  const header = Buffer.from([0, 0, 0x81, 0x80, 0, 1, 0, 1, 0, 0, 0, 0])
  query.copy(header, 0, 0, 2)
  const answer = Buffer.from([0xc0, 12, 0, 1, 0, 1, 0, 0, 0, 0, 0, 4, ...DNS_ANSWER])
  dnsResponder.send(Buffer.concat([header, question, answer]), from.port, from.address)
})
before(async () => {
  const addresses = Object.entries(networkInterfaces()).flatMap(([name, list]) =>
    (list ?? []).filter((a) => a.family === 'IPv4' && !a.internal).map((a) => ({ name, ...a })),
  )
  const bridge = /^(docker|br-|veth)/
  egressTarget.host =
    (addresses.find((a) => !bridge.test(a.name)) ?? addresses[0])?.address ?? '127.0.0.1'
  await new Promise<void>((resolve) => listener.listen(0, '0.0.0.0', resolve))
  egressTarget.port = (listener.address() as AddressInfo).port
  await new Promise<void>((resolve) => dnsResponder.bind(0, '0.0.0.0', resolve))
})
after(() => {
  listener.close()
  dnsResponder.close()
})

/** The token `workspace/token` fetches with, and the git HTTP server that insists on it. */
const GIT_TOKEN = 'reeval-fixture-git-token-5e0b77c2d9a1'
let gitHttp: GitHttp
before(async () => {
  gitHttp = await gitHttpServer(GIT_TOKEN)
})
after(() => gitHttp.close())

/** The fake Boat API the `boat-*` fixtures run on, its sandboxes sshd containers. */
let boatApi: FakeBoat
before(async () => {
  boatApi = await fakeBoat(startSshVm, { saved: startBoatDockerVm })
})
after(() => boatApi.close())
/** The fake VM service the `cloud-*` fixtures run through, whose every VM has the host's Docker. */
let dockerBoatApi: FakeBoat
let vmService: FakeVmService
before(async () => {
  dockerBoatApi = await fakeBoat(startBoatDockerVm)
  vmService = await fakeVmService(dockerBoatApi, { maxLive: 10, maxStarts: 100 })
})
after(async () => {
  await vmService.close()
  await dockerBoatApi.close()
})
let boatBuilds: Promise<unknown> = Promise.resolve()
/**
 * Builds a `boat-*` fixture's snapshot before its run, one fixture at a time: every fake VM shares
 * the host's Docker, so two runs building one snapshot at once would keep it in one container.
 */
const buildOnFakeBoat = (dir: string) => {
  buildSshVmImage(['boat', 'boat-docker'])
  const built = boatBuilds.then(async () => {
    const r = await runCli(dir, ['image', 'build'], {
      env: { BOAT_BASE_URL: boatApi.url, BOAT_API_KEY: boatApi.key },
      timeoutMs: 180_000,
    })
    assert.equal(r.code, 0, r.stdout + r.stderr)
  })
  boatBuilds = built.catch(() => {})
  return built
}
/** The images the fake VMs kept on the host's Docker, by key, removed once every fixture is done. */
const keptImages = new Set<string>()
after(() => {
  for (const key of keptImages) {
    execFileSync('docker', ['rm', '--force', `reeval-keep-${key}`], { stdio: 'ignore' })
    execFileSync('docker', ['image', 'rm', '--force', `reeval-vm-image:${key}`], {
      stdio: 'ignore',
    })
  }
})
/** A `boat-*` fixture's host: reeval pointed at the fake API, its snapshot built. */
const onFakeBoat: Pick<Feature, 'sandbox' | 'hostEnv' | 'prepare'> = {
  sandbox: 'docker',
  hostEnv: () => ({ BOAT_BASE_URL: boatApi.url, BOAT_API_KEY: boatApi.key }),
  prepare: buildOnFakeBoat,
}
/** No sandbox of the run is left on the fake API. */
const boatCleanedUp = (run: RunRecord, sandbox: { prefix: string } = boat(), api = boatApi) => {
  for (const a of run.evals.flatMap((e) => e.attempts)) {
    if (a.sandboxBase?.provider === 'boat') keptImages.add(a.sandboxBase.key.slice(0, 12))
  }
  const prefix = runPrefix(sandbox, run.runId)
  assert.deepEqual(
    api.live().filter((name) => name.startsWith(prefix)),
    [],
    'every Boat sandbox of the run is deleted',
  )
  assert.ok(
    api.requests.some(
      (q) => q.call === 'POST /sandboxes' && String(q.body?.name).startsWith(prefix),
    ),
    'the run created its sandboxes on the fake API',
  )
}

/** How many sandboxes the run created on the fake API. */
const boatCreates = (run: RunRecord, sandbox: { prefix: string } = boat(), api = boatApi) => {
  const prefix = runPrefix(sandbox, run.runId)
  return api.requests.filter(
    (q) => q.call === 'POST /sandboxes' && !q.refused && String(q.body?.name).startsWith(prefix),
  ).length
}

/** What every cloud VM's name starts with. */
const CLOUD_VM = { prefix: 'reeval' }
/** A `cloud-*` fixture's host: REEVAL_VM_URL and REEVAL_VM_TOKEN, pointed at the fake service. */
const onFakeCloud: Pick<Feature, 'sandbox' | 'hostEnv' | 'prepare'> = {
  sandbox: 'cloud',
  hostEnv: () => ({
    REEVAL_VM_URL: vmService.url,
    REEVAL_VM_TOKEN: vmService.token,
    REEVAL_SANDBOX_LABELS: 'sweep-job=42',
  }),
  prepare: () => buildSshVmImage(['boat', 'boat-docker']),
}
/**
 * Every VM of the run was made labeled and deleted, and neither the record nor the attempts'
 * debug logs name the provider.
 */
const cloudCleanedUp = (run: RunRecord, project: string) => {
  boatCleanedUp(run, CLOUD_VM, dockerBoatApi)
  assert.deepEqual(
    vmService.requests.filter(
      (q) => q.status >= 400 && !(q.status === 404 && q.call.startsWith('GET ')),
    ),
    [],
    'the service took every call',
  )
  for (const q of dockerBoatApi.requests) {
    if (
      q.call !== 'POST /sandboxes' ||
      !String(q.body?.name).startsWith(runPrefix(CLOUD_VM, run.runId))
    )
      continue
    assert.deepEqual(q.body?.labels, {
      'sweep-job': '42',
      ...runLabels(CLOUD_VM, run.runId),
      [VM_RUN_LABEL]: vmService.runId,
    })
  }
  assert.doesNotMatch(JSON.stringify(run), /boat/i, 'the record names no provider')
  for (const log of debugLogs(project)) {
    assert.deepEqual(
      log.filter((l) => /boat/i.test(l)),
      [],
      'nor does the debug log',
    )
  }
}

/** The fake Daytona API the `daytona-*` fixtures run on, its sandboxes sshd containers. */
let daytonaApi: FakeDaytona
before(async () => {
  daytonaApi = await fakeDaytona(startDaytonaVm, {
    build: async (dockerfile) => {
      await buildDaytonaImage(dockerfile)
    },
  })
})
after(() => daytonaApi.close())
/** A `daytona-*` fixture's host: reeval pointed at the fake API, the VM image built. */
const onFakeDaytona: Pick<Feature, 'sandbox' | 'hostEnv' | 'prepare'> = {
  sandbox: 'docker',
  hostEnv: () => ({ DAYTONA_API_URL: daytonaApi.url, DAYTONA_API_KEY: daytonaApi.key }),
  prepare: () => buildSshVmImage(),
}
/** The sandboxes the run created on the fake API, by the labels its cleanup lists by. */
const daytonaCreated = (run: RunRecord, sandbox = daytona()) => {
  const labels = runLabels(sandbox, run.runId)
  return daytonaApi
    .created()
    .filter((s) => Object.entries(labels).every(([k, v]) => s.labels[k] === v))
}
/** No sandbox of the run is left on the fake API. */
const daytonaCleanedUp = (run: RunRecord, sandbox = daytona()) => {
  const made = daytonaCreated(run, sandbox).map((s) => s.name)
  assert.ok(made.length > 0, 'the run created its sandboxes on the fake API')
  assert.deepEqual(
    daytonaApi.live().filter((name) => made.includes(name)),
    [],
    'every Daytona sandbox of the run is deleted',
  )
}

/** Every file under `dir`, for a check that a value was written to none of them. */
const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))

/**
 * A local npm registry for `skill.npm`: `prepare` packs a fixture's package versions into it, and
 * `npm pack` on the host reaches it through `npm_config_registry`.
 */
const npmRegistry = {
  url: '',
  packages: new Map<string, Map<string, Buffer>>(),
  fetched: [] as string[],
}
const registry = createServer((req, res) => {
  const path = decodeURIComponent(req.url ?? '/').slice(1)
  const tarball = /^(.+)\/-\/([^/]+)\.tgz$/.exec(path)
  const versions = npmRegistry.packages.get(tarball?.[1] ?? path)
  if (!versions) {
    res.statusCode = 404
    res.end('{}')
    return
  }
  if (tarball) {
    const body = versions.get(tarball[2] ?? '')
    if (body) npmRegistry.fetched.push(`${tarball[1]}@${tarball[2]}`)
    res.statusCode = body ? 200 : 404
    res.end(body ?? '')
    return
  }
  const name = path
  const entries = [...versions].map(([version, body]) => [
    version,
    {
      name,
      version,
      dist: {
        tarball: `${npmRegistry.url}${name}/-/${version}.tgz`,
        shasum: createHash('sha1').update(body).digest('hex'),
        integrity: `sha512-${createHash('sha512').update(body).digest('base64')}`,
      },
    },
  ])
  res.setHeader('content-type', 'application/json')
  res.end(
    JSON.stringify({
      name,
      'dist-tags': { latest: entries.at(-1)?.[0] },
      versions: Object.fromEntries(entries),
    }),
  )
})
before(async () => {
  await new Promise<void>((resolve) => registry.listen(0, '127.0.0.1', resolve))
  npmRegistry.url = `http://127.0.0.1:${(registry.address() as AddressInfo).port}/`
})
after(() => registry.close())

/**
 * A scripted vision model on Anthropic's Messages API, for `ui/capture-use-history`: it picks each
 * move of the fixture's sign-up from the moves its prompt lists, so a driver that sends no history
 * gets the first move every time. As `scripted-stuck`, for `ui/capture-use-stuck`, it clicks the
 * same empty spot every time.
 */
const scriptedVision = { url: '', prompts: [] as string[] }
const SIGN_UP_MOVES: Array<[string, object]> = [
  ['click', { x: 200, y: 115 }],
  ['type', { text: 'ada@example.com' }],
  ['click', { x: 200, y: 165 }],
  ['type', { text: 'Test1234!' }],
  ['click', { x: 200, y: 215 }],
  ['done', {}],
]
const visionModel = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })
  req.on('end', () => {
    const { model, messages } = JSON.parse(body) as {
      model: string
      messages: Array<{ content: string | Array<{ type: string; text?: string }> }>
    }
    const text = messages
      .flatMap((m) =>
        typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content,
      )
      .flatMap((part) => (part.type === 'text' && part.text ? [part.text] : []))
      .join('\n')
    scriptedVision.prompts.push(text)
    const [name, input] =
      model === 'scripted-stuck'
        ? ['click', { x: 600, y: 600 }]
        : (SIGN_UP_MOVES[text.match(/^\d+\. /gm)?.length ?? 0] ?? ['done', {}])
    res.setHeader('content-type', 'application/json')
    res.end(
      JSON.stringify({
        id: `msg_${scriptedVision.prompts.length}`,
        type: 'message',
        role: 'assistant',
        model: 'scripted-vision',
        content: [{ type: 'tool_use', id: `toolu_${scriptedVision.prompts.length}`, name, input }],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    )
  })
})
before(async () => {
  await new Promise<void>((resolve) => visionModel.listen(0, '127.0.0.1', resolve))
  scriptedVision.url = `http://127.0.0.1:${(visionModel.address() as AddressInfo).port}/v1`
})
after(() => visionModel.close())

/** `npm pack` of `cwd` into `out`: the tarball's name. */
function npmPack(cwd: string, out: string): string {
  const r = spawnTool('npm', ['pack', '--silent', '--pack-destination', out], {
    cwd,
    encoding: 'utf8',
  })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout
}

/** Packs each `<dir>/<version>/` with `npm pack` into the local registry, oldest first. */
function publish(dir: string) {
  const out = join(dir, '.packed')
  mkdirSync(out, { recursive: true })
  for (const version of readdirSync(dir)
    .filter((v) => /^\d/.test(v))
    .sort()) {
    const file = npmPack(join(dir, version), out).trim().split('\n').at(-1) as string
    const { name } = JSON.parse(readFileSync(join(dir, version, 'package.json'), 'utf8'))
    const versions = npmRegistry.packages.get(name) ?? new Map<string, Buffer>()
    versions.set(version, readFileSync(join(out, file)))
    npmRegistry.packages.set(name, versions)
  }
}
const egressEnv = () => ({
  REEVAL_EGRESS_HOST: egressTarget.host,
  REEVAL_EGRESS_TARGET: `${egressTarget.host}:${egressTarget.port}`,
  REEVAL_EGRESS_DNS: `${egressTarget.host}:${dnsResponder.address().port}`,
  REEVAL_EGRESS_DNS_ANSWER: DNS_ANSWER.join('.'),
})

/** Each fixture project's fake `tart` directory, for a row run under `tart()`. */
const fakeTarts = new Map<string, string>()

/** The `lands` eval's first attempt. */
const landed = (run: RunRecord) => run.evals.find((e) => e.name === 'lands')?.attempts[0]

/** The canary eval's first failed attempt, else its first. */
const canaryAttempt = (run: RunRecord) => {
  const attempts = run.evals.find((e) => e.name === 'canary')?.attempts ?? []
  return attempts.find((a) => a.outcome === 'fail') ?? attempts[0]
}

/**
 * What a canary saw: a RegExp matches a string, or another value's JSON; a function is a predicate;
 * a plain object matches an object key by key (keys it leaves out are free); anything else is
 * deep-equal.
 */
type Saw = JSONValue | RegExp | ((saw: JSONValue | undefined) => boolean) | { [key: string]: Saw }

const sawMatches = (saw: JSONValue | undefined, want: Saw, what: string): void => {
  if (want instanceof RegExp) {
    assert.match(typeof saw === 'string' ? saw : String(JSON.stringify(saw)), want, what)
  } else if (typeof want === 'function') {
    assert.ok(want(saw), `${what}: ${JSON.stringify(saw)}`)
  } else if (want !== null && typeof want === 'object' && !Array.isArray(want)) {
    assert.ok(
      saw !== null && typeof saw === 'object' && !Array.isArray(saw),
      `${what}: ${JSON.stringify(saw)} is an object`,
    )
    for (const [key, w] of Object.entries(want)) sawMatches(saw[key], w, `${what}.${key}`)
  } else assert.deepEqual(saw, want, what)
}

/** An eval's first attempt's grades, as `[grader, grade, score]`. */
const graded = (run: RunRecord, name: string) =>
  run.evals
    .find((e) => e.name === name)
    ?.attempts[0]?.grades?.map((g) => [g.grader, g.grade, g.score])

const skills = (run: RunRecord) => run.environments.flatMap((e) => e.skills)
const plugins = (run: RunRecord) => run.environments.flatMap((e) => e.plugins ?? [])
const envFiles = (run: RunRecord) => run.environments.flatMap((e) => e.files.map((f) => f.path))

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    encoding: 'utf8',
  }).trim()

/**
 * `repo/` from `repo-src/`: `v1/` committed and tagged `v1`, then `v2/` committed on `main`. It
 * serves partial fetches, as a hosted repository does, so a `path` fetches only its blobs.
 */
const versionedRepo = (dir: string) => {
  const repo = join(dir, 'repo')
  execFileSync('git', ['init', '-q', '-b', 'main', repo])
  git(repo, 'config', 'uploadpack.allowFilter', 'true')
  for (const version of ['v1', 'v2']) {
    for (const entry of readdirSync(repo)) {
      if (entry !== '.git') rmSync(join(repo, entry), { recursive: true, force: true })
    }
    cpSync(join(dir, 'repo-src', version), repo, { recursive: true })
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', version)
    if (version === 'v1') git(repo, 'tag', 'v1')
  }
  return repo
}

const workspaceOf = (run: RunRecord) => run.environments.find((e) => e.workspace)?.workspace

/** An eval's first attempt's first grade, a judge grader's. */
const judgeGradeOf = (run: RunRecord, name = 'lands') => {
  const grade = run.evals.find((e) => e.name === name)?.attempts[0]?.grades?.[0]
  assert.ok(grade?.kind === 'judge', JSON.stringify(grade))
  return grade
}

/** An eval's one compare answer, with a vote on each order of its one pair. */
const answerOf = (run: RunRecord, name: string) => {
  const answer = run.evals.find((e) => e.name === name)?.answers?.[0]
  assert.ok(answer, `${name} has an answer`)
  assert.equal(answer.error, undefined, answer.error)
  assert.equal(answer.votes.length, 2, JSON.stringify(answer.votes))
  return answer
}

/** What each vote was shown, as the fixture's fake vote reports it in its reason; equal orders once. */
const shownOf = (answer: NonNullable<RunRecord['evals'][number]['answers']>[number]) =>
  [...new Set(answer.votes.map((v) => v.reason ?? ''))].map((r) => JSON.parse(r))

/** A row's name: its directory, and for a parameterized fixture the harness it runs as. */
export const rowName = (f: Pick<Feature, 'dir' | 'layout'>) =>
  f.layout ? `${f.dir}:${f.layout}` : f.dir

/**
 * One row per harness for a fixture whose `reeval.config.ts` reads REEVAL_FIXTURE_LAYOUT: the fake
 * agent takes each harness's layout and runs in its image, so each harness has its own check and
 * its own failing canary.
 */
const perHarness = (
  layouts: readonly BakedHarness[],
  row: (layout: BakedHarness) => Omit<Feature, 'layout' | 'image'>,
): Feature[] => layouts.map((layout) => ({ ...row(layout), layout, image: layout }))

const BUT_CURSOR = BAKED_HARNESSES.filter((h) => h !== 'cursor')
/** The harnesses tart() runs, listed so one it stops running fails its row rather than losing it. */
const TART_HARNESSES = [
  'cursor',
  'claude-code',
  'antigravity',
  'opencode',
  'goose',
  'pi',
  'codex',
  'fx',
  'grok-build',
] as const satisfies readonly BakedHarness[]
/** A regex for exactly `text`. */
const literally = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** A canary's failure when its one grader, `grader`, scored 0 against the threshold `below`. */
const zeroBy = (grader: string, below = 1) =>
  new RegExp(
    `^score 0\\.00 below ${literally(String(below))}: ${literally(grader)}(?: \\(required\\))? scored 0\\.00$`,
  )

/** The `agentCli` a Dockerfile built on each harness's image records. */
const AGENT_CLI: Partial<Record<BakedHarness, RegExp>> = {
  antigravity: new RegExp(`^${literally(ANTIGRAVITY_CLI_VERSION)}$`),
  'claude-code': /\(Claude Code\)$/,
  codex: new RegExp(`^codex-cli ${literally(CODEX_CLI_VERSION)}$`),
  fx: new RegExp(`${literally(FX_CLI_VERSION)}$`),
  goose: new RegExp(`${literally(GOOSE_CLI_VERSION)}$`),
  'grok-build': new RegExp(`^grok ${literally(GROK_CLI_VERSION)}\\b`),
  opencode: new RegExp(`^opencode v${literally(OPENCODE_CLI_VERSION)}$`),
  pi: new RegExp(`^${literally(PI_CLI_VERSION)}$`),
}
/** Where a plugin kept whole must not be placed: the harness's own home skills. */
const OWN_SKILLS: Partial<Record<BakedHarness, string>> = {
  codex: '~/.agents/skills/house-style/SKILL.md',
  'grok-build': '/.grok/skills/house-style/',
}

export const features: Feature[] = [
  {
    dir: 'config/found-from-subdirectory',
    tiers: ['fake', 'docker'],
    cwd: 'deep/nested',
    env: 'found',
    canary: zeroBy('observed:marker.txt'),
    canarySaw: { 'marker.txt': 'from the project root\n' },
    record: ({ project }) =>
      assert.deepEqual(
        readdirSync(join(project, 'deep/nested')),
        ['marker.txt'],
        'the run is written under the config, not the current directory',
      ),
  },
  {
    dir: 'skills/setup-installed',
    tiers: ['fake', 'docker'],
    env: 'installed',
    canary: zeroBy('used-skill:house-farewell'),
    record: async ({ run, project, tier }) => {
      assert.deepEqual(skills(run), [], 'reeval placed no skill')
      const r = await runCli(project, [
        'query',
        'SELECT skill, source, reads FROM skill_reads ORDER BY eval_key, skill',
        '--json',
      ])
      assert.equal(r.code, 0, r.stderr)
      const rows = (
        JSON.parse(r.stdout) as Array<{ skill: string; source: string; reads: number }>
      ).map((x) => [x.skill, x.source, x.reads])
      // The canary's attempt and the check's, each opening house-greeting. Only an isolated
      // sandbox takes the context, which also lists the installed skill nobody opened.
      const unread = tier === 'fake' ? [] : [['house-farewell', 'skill-dir', 0]]
      assert.deepEqual(rows, [
        ...unread,
        ['house-greeting', 'skill-dir', 1],
        ...unread,
        ['house-greeting', 'skill-dir', 1],
      ])
    },
  },
  {
    dir: 'skills/workspace-placement',
    tiers: ['fake', 'docker'],
    env: 'greeting',
    canary: zeroBy('observed:staged-files'),
    canarySaw: { 'staged-files': [''] },
    record: ({ run }) =>
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.placement, s.source]),
        [['house-greeting', 'workspace', 'local:skills/house-greeting']],
      ),
  },
  {
    dir: 'skills/workspace-content',
    tiers: ['fake', 'docker'],
    env: 'greeting',
    canary: zeroBy('observed:SKILL.md'),
  },
  {
    dir: 'skills/exclude-default',
    tiers: ['fake', 'docker'],
    env: 'greeting',
    canary: zeroBy('observed:staged-files'),
    record: ({ run }) =>
      assert.deepEqual(skills(run)[0]?.excluded, ['.history/', 'evals/', 'greets.eval.ts']),
  },
  {
    dir: 'skills/exclude-custom',
    tiers: ['fake', 'docker'],
    env: 'greeting',
    canary: zeroBy('observed:staged-files'),
    record: ({ run }) => assert.deepEqual(skills(run)[0]?.excluded, ['drafts/', 'notes.tmp']),
  },
  {
    dir: 'skills/git-ref',
    tiers: ['fake', 'docker'],
    env: 'greeting-v1',
    canary: zeroBy('observed:SKILL.md'),
    canarySaw: { 'SKILL.md': /Ahoy, <name>!/ },
    prepare(dir) {
      const repo = join(dir, 'repo')
      const commit = (version: string) => {
        rmSync(join(repo, 'skills'), { recursive: true, force: true })
        cpSync(join(dir, 'skill-repo', version), repo, { recursive: true })
        git(repo, 'add', '-A')
        git(repo, 'commit', '-q', '-m', version)
      }
      execFileSync('git', ['init', '-q', '-b', 'main', repo])
      commit('v1')
      git(repo, 'tag', 'v1')
      commit('v2')
    },
    record: ({ run, project }) => {
      const [s] = skills(run)
      assert.equal(s?.commit, git(join(project, 'repo'), 'rev-parse', 'v1'))
      assert.match(s?.source ?? '', /#v1:skills$/)
    },
  },
  {
    dir: 'workspace/git-subpath',
    tiers: ['fake', 'docker'],
    env: 'app-v1',
    canary: zeroBy('observed:greet.js'),
    canarySaw: { 'greet.js': /Hello/ },
    prepare: versionedRepo,
    record: ({ run, project }) => {
      const repo = join(project, 'repo')
      assert.deepEqual(workspaceOf(run), {
        source: 'repo',
        ref: 'v1',
        path: 'app',
        commit: git(repo, 'rev-parse', 'v1'),
        tree: git(repo, 'rev-parse', 'v1:app'),
      })
      // A partial fetch: the cache has app/'s blobs, not the rest of the repository's.
      const [cache] = readdirSync(join(project, '.reeval/cache/git/repos'))
      const missing = git(
        join(project, '.reeval/cache/git/repos', cache ?? ''),
        'rev-list',
        '--objects',
        '--missing=print',
        git(repo, 'rev-parse', 'v1'),
      )
      assert.match(missing, new RegExp(`^\\?${git(repo, 'rev-parse', 'v1:README.md')}$`, 'm'))
      assert.doesNotMatch(
        missing,
        new RegExp(`^\\?${git(repo, 'rev-parse', 'v1:app/greet.js')}`, 'm'),
      )
    },
  },
  {
    dir: 'workspace/init',
    tiers: ['fake', 'docker'],
    env: 'with-git',
    canary: zeroBy('observed:git'),
    canarySaw: { git: '1\n' },
    prepare: versionedRepo,
    record: ({ run }) => assert.equal(workspaceOf(run)?.init, true),
  },
  {
    dir: 'workspace/token',
    tiers: ['fake', 'docker'],
    env: 'private',
    canary: zeroBy('observed:greet.js'),
    canarySaw: { 'greet.js': /Hello/ },
    prepare: versionedRepo,
    hostEnv: (dir) => ({
      REEVAL_GIT_HTTP: gitHttp.serve(dir),
      REEVAL_FIXTURE_GIT_TOKEN: GIT_TOKEN,
    }),
    record: ({ run, project }) => {
      assert.equal(workspaceOf(run)?.ref, 'v1')
      const header = Buffer.from(`x-access-token:${GIT_TOKEN}`).toString('base64')
      for (const file of filesUnder(join(project, '.reeval'))) {
        const text = readFileSync(file, 'latin1')
        assert.ok(!text.includes(GIT_TOKEN) && !text.includes(header), `the token is in ${file}`)
      }
    },
  },
  {
    // Docker only: the fake sandbox runs on the host, whose environment has the variable.
    dir: 'workspace/token-sandbox-env',
    tiers: ['docker'],
    env: 'private',
    canary: zeroBy('observed:token-in-sandbox'),
    prepare: versionedRepo,
    hostEnv: (dir) => ({
      REEVAL_GIT_HTTP: gitHttp.serve(dir),
      REEVAL_FIXTURE_GIT_TOKEN: GIT_TOKEN,
    }),
  },
  {
    dir: 'workspace/missing-ref',
    tiers: ['fake', 'docker'],
    env: 'missing',
    canaryEnv: 'pinned',
    lands: {
      outcome: 'infra_error',
      error: {
        kind: 'infra',
        message:
          /^Workspace git\("\.\.\/repo#v9"\): the repository has no ref "v9" \(a branch, tag or commit SHA\)\.\n\(the workspace git\("\.\.\/repo#v9"\), set by environment missing, failed to prepare before the run started; every attempt that needs it fails with this\)$/,
      },
    },
    canary: zeroBy('observed:greet.js'),
    canarySaw: { 'greet.js': /Hello/ },
    prepare: versionedRepo,
    record: ({ run }) => {
      const prepare = run.evals.flatMap((e) => e.attempts).find((a) => a.error?.prepare)
        ?.error?.prepare
      assert.deepEqual(prepare, {
        class: 'config',
        stage: 'workspace',
        ref: '../repo#v9',
        cause: null,
        log: null,
        setBy: ['environment missing'],
      })
    },
  },
  {
    dir: 'workspace/files-over-repo',
    tiers: ['fake', 'docker'],
    env: 'patched',
    canary: zeroBy('observed:greet.js'),
    canarySaw: { 'greet.js': /Howdy/ },
    prepare: versionedRepo,
    record: ({ run }) => assert.deepEqual(envFiles(run), ['greet.js']),
  },
  {
    dir: 'workspace/setup-in-repo',
    tiers: ['fake', 'docker'],
    env: 'built',
    canary: zeroBy('observed:seen-by-setup.txt'),
    canarySaw: { 'seen-by-setup.txt': 'v1\n' },
    prepare: versionedRepo,
    record: ({ run, project }) =>
      assert.equal(workspaceOf(run)?.commit, git(join(project, 'repo'), 'rev-parse', 'v1')),
  },
  {
    dir: 'skills/git-skills-dir',
    tiers: ['fake', 'docker'],
    env: 'skills-dir',
    canary: zeroBy('observed:SKILL.md'),
    canarySaw: { 'SKILL.md': /Ahoy, <name>!/ },
    prepare(dir) {
      const repo = join(dir, 'repo')
      cpSync(join(dir, 'skill-repo'), repo, { recursive: true })
      execFileSync('git', ['init', '-q', '-b', 'main', repo])
      git(repo, 'add', '-A')
      git(repo, 'commit', '-q', '-m', 'skills')
    },
    record: ({ run }) => {
      const [skill] = skills(run)
      assert.equal(skill?.name, 'house-greeting')
      assert.match(skill?.source ?? '', /repo:skills$/, 'the source names the skills/ it used')
    },
  },
  {
    dir: 'skills/registry-version',
    tiers: ['fake', 'docker'],
    env: 'registry-v1',
    canary: zeroBy('observed:SKILL.md'),
    canarySaw: { 'SKILL.md': /Ahoy, <name>!/ },
    prepare(dir) {
      const repo = join(dir, 'registry/acme/skills.git')
      const commit = (version: string) => {
        rmSync(join(repo, 'skills'), { recursive: true, force: true })
        cpSync(join(dir, 'skill-repo', version), repo, { recursive: true })
        git(repo, 'add', '-A')
        git(repo, 'commit', '-q', '-m', version)
      }
      execFileSync('git', ['init', '-q', '-b', 'main', repo])
      commit('v1')
      git(repo, 'tag', 'v1')
      commit('v2')
    },
    // skill.registry clones https://github.com/acme/skills.git; git sends that to the fixture's repo.
    hostEnv: (dir) => ({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: `url.file://${join(dir, 'registry')}/.insteadOf`,
      GIT_CONFIG_VALUE_0: 'https://github.com/',
    }),
    record: ({ run, project }) => {
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.source, s.commit]),
        [
          [
            'house-greeting',
            'registry:acme/skills@house-greeting#v1',
            git(join(project, 'registry/acme/skills.git'), 'rev-parse', 'v1'),
          ],
        ],
        'only the named skill, at the tagged commit',
      )
    },
  },
  {
    dir: 'skills/npm-package',
    tiers: ['fake', 'docker'],
    env: 'npm-1.2.3',
    canary: zeroBy('observed:SKILL.md'),
    canarySaw: { 'SKILL.md': /Ahoy, <name>!/ },
    prepare: (dir) => publish(join(dir, 'packages')),
    hostEnv: (dir) => ({
      npm_config_registry: npmRegistry.url,
      npm_config_cache: join(dir, '.npm-cache'),
    }),
    record: ({ run }) => {
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.source]),
        [['house-greeting', 'npm:@acme/skills@1.2.3:skills']],
      )
      assert.ok(npmRegistry.fetched.includes('@acme/skills@1.2.3'), 'fetched from the registry')
      assert.ok(!npmRegistry.fetched.includes('@acme/skills@1.2.4'), 'never the latest')
    },
  },
  {
    dir: 'skills/npm-local-path',
    tiers: ['fake', 'docker'],
    env: 'npm-vendored',
    canary: zeroBy('observed:SKILL.md'),
    canarySaw: { 'SKILL.md': /Ahoy, <name>!/ },
    prepare(dir) {
      const vendor = join(dir, 'vendor')
      mkdirSync(vendor)
      for (const version of ['1.2.3', '1.2.4']) {
        npmPack(join(dir, 'packages', version), vendor)
      }
    },
    hostEnv: (dir) => ({ npm_config_cache: join(dir, '.npm-cache') }),
    record: ({ run }) =>
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.source]),
        [['house-greeting', 'npm:vendor/acme-skills-1.2.3.tgz:skills']],
      ),
  },
  {
    dir: 'plugins/local-lands',
    tiers: ['fake', 'docker'],
    env: 'review',
    canary: zeroBy('observed:review.md'),
    canarySaw: { 'review.md': '' },
    record: ({ run }) => {
      const [p] = plugins(run)
      assert.deepEqual(
        { name: p?.name, source: p?.source, commit: p?.commit, build: p?.build },
        { name: 'review', source: 'local:plugin', commit: null, build: null },
      )
      assert.deepEqual(p?.parts, {
        skills: ['review-lint'],
        agents: ['reviewer'],
        commands: [],
        hooks: [],
        mcp: ['docs'],
        rules: false,
      })
      assert.match(p?.sha256 ?? '', /^[0-9a-f]{64}$/)
      assert.deepEqual(
        run.environments.map((e) => e.mcp),
        [['review:docs']],
      )
    },
  },
  {
    dir: 'plugins/only-skills',
    tiers: ['fake', 'docker'],
    env: 'review',
    canary: zeroBy('observed:reviewer.md'),
    canarySaw: { 'reviewer.md': '' },
    record: ({ run }) => {
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.placement, s.plugin]),
        [['review-lint', 'harness', 'review']],
      )
      assert.deepEqual(plugins(run)[0]?.parts.agents, [])
      assert.deepEqual(
        run.environments.map((e) => e.mcp),
        [[]],
      )
    },
  },
  {
    dir: 'plugins/build-layer',
    tiers: ['docker'],
    env: 'built',
    canary: zeroBy('observed:built.txt'),
    canarySaw: { 'built.txt': '' },
    record: ({ run }) => {
      const [p] = plugins(run)
      assert.equal(p?.name, 'built')
      assert.match(p?.build ?? '', /^reeval-plugin:[0-9a-f]{12}-[0-9a-f]{16}$/)
      assert.ok(run.stack.images.some((i) => i.ref === p?.build))
    },
  },
  {
    dir: 'plugins/marketplace-build',
    tiers: ['docker'],
    env: 'built',
    canary: zeroBy('observed:built.txt'),
    canarySaw: { 'built.txt': '' },
    prepare(dir) {
      const repo = join(dir, 'repo')
      cpSync(join(dir, 'market-repo'), repo, { recursive: true })
      execFileSync('git', ['init', '-q', '-b', 'main', repo])
      git(repo, 'add', '-A')
      git(repo, 'commit', '-q', '-m', 'v1')
      git(repo, 'tag', 'v1')
    },
    record: ({ run, project }) => {
      const commit = git(join(project, 'repo'), 'rev-parse', 'v1')
      const [p] = plugins(run)
      assert.equal(p?.name, 'built')
      assert.equal(p?.commit, commit)
      assert.deepEqual(p?.marketplace && { ...p.marketplace, source: undefined }, {
        name: 'acme-tools',
        source: undefined,
        commit,
      })
      assert.match(p?.build ?? '', /^reeval-plugin:[0-9a-f]{12}-[0-9a-f]{16}$/)
      assert.ok(run.stack.images.some((i) => i.ref === p?.build))
    },
  },
  {
    dir: 'plugins/git-ref',
    tiers: ['fake', 'docker'],
    env: 'review-v1',
    canary: zeroBy('observed:reviewer.md'),
    canarySaw: { 'reviewer.md': '' },
    prepare(dir) {
      const repo = join(dir, 'repo')
      const commit = (version: string) => {
        rmSync(join(repo, 'plugins'), { recursive: true, force: true })
        cpSync(join(dir, 'plugin-repo', version), repo, { recursive: true })
        git(repo, 'add', '-A')
        git(repo, 'commit', '-q', '-m', version)
      }
      execFileSync('git', ['init', '-q', '-b', 'main', repo])
      commit('v1')
      git(repo, 'tag', 'v1')
      commit('v2')
    },
    record: ({ run, project }) => {
      const [p] = plugins(run)
      assert.equal(p?.commit, git(join(project, 'repo'), 'rev-parse', 'v1'))
      assert.match(p?.source ?? '', /#v1:plugins\/review$/)
      assert.deepEqual(p?.parts.commands, ['review'])
    },
  },
  {
    dir: 'plugins/marketplace-entry',
    tiers: ['fake', 'docker'],
    env: 'review-entry',
    canary: zeroBy('observed:lint.md'),
    canarySaw: { 'lint.md': '' },
    prepare(dir) {
      const repo = join(dir, 'repo')
      cpSync(join(dir, 'market-repo'), repo, { recursive: true })
      execFileSync('git', ['init', '-q', '-b', 'main', repo])
      git(repo, 'add', '-A')
      git(repo, 'commit', '-q', '-m', 'v1')
      git(repo, 'tag', 'v1')
    },
    record: ({ run, project }) => {
      const commit = git(join(project, 'repo'), 'rev-parse', 'v1')
      assert.deepEqual(
        plugins(run).map((p) => ({
          name: p.name,
          commit: p.commit,
          marketplace: p.marketplace && { ...p.marketplace, source: typeof p.marketplace.source },
        })),
        [{ name: 'review', commit, marketplace: { name: 'acme-tools', source: 'string', commit } }],
      )
      const [p] = plugins(run)
      assert.match(p?.marketplace?.source ?? '', /^file:\/\/.*\/repo#v1$/)
      assert.match(p?.source ?? '', /^file:\/\/.*\/repo#v1:plugins\/review$/)
      assert.deepEqual(p?.parts.agents, ['reviewer'])
    },
  },
  {
    dir: 'plugins/npm-package',
    tiers: ['fake', 'docker'],
    env: 'review-1.2.3',
    canary: zeroBy('observed:hooks.json'),
    canarySaw: { 'hooks.json': '' },
    prepare: (dir) => publish(join(dir, 'packages')),
    hostEnv: (dir) => ({
      npm_config_registry: npmRegistry.url,
      npm_config_cache: join(dir, '.npm-cache'),
    }),
    record: ({ run }) => {
      assert.deepEqual(
        plugins(run).map((p) => [p.name, p.source, p.parts.mcp, p.parts.hooks]),
        [['review', 'npm:@acme/review-plugin@1.2.3', ['docs'], []]],
      )
      assert.ok(
        npmRegistry.fetched.includes('@acme/review-plugin@1.2.3'),
        'fetched from the registry',
      )
      assert.ok(!npmRegistry.fetched.includes('@acme/review-plugin@1.2.4'), 'never the latest')
    },
  },
  {
    dir: 'skills/only-missing',
    tiers: ['fake', 'docker'],
    env: 'typo',
    canaryEnv: 'picked',
    lands: {
      outcome: 'infra_error',
      error: {
        kind: 'infra',
        message:
          /^only: \["house-greting"\] not found in local:skills \(found: house-farewell, house-greeting\)$/,
      },
    },
    canary: zeroBy('observed:staged-skills'),
    canarySaw: { 'staged-skills': ['house-greeting'] },
  },
  {
    dir: 'skills/harness-placement',
    tiers: ['fake', 'docker', 'real'],
    env: 'greeting',
    canary: zeroBy('observed:shell-output'),
    canarySaw: { 'shell-output': '' },
    record: ({ run, tier }) => {
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.placement]),
        [['house-greeting', 'harness']],
      )
      if (tier === 'fake') return
      // In the agent's home, taken after the turn: the fake's ~/.agents, or Cursor's adapter home.
      // Adapters write SKILL.md afresh from its frontmatter and body, so the hash isn't the file's.
      const seen = landed(run)?.context ?? []
      assert.ok(
        seen.some((c) => /^~\/(.+\/)?\.agents\/skills\/house-greeting\/SKILL\.md$/.test(c.path)),
        JSON.stringify(seen),
      )
    },
  },
  {
    dir: 'mcp/stdio-reaches-harness',
    tiers: ['docker', 'real'],
    env: 'stamp',
    canary: zeroBy('succeeded:tool called'),
    record: ({ run }) =>
      assert.deepEqual(
        run.environments.map((e) => [e.name, e.mcp]),
        [['stamp', ['stamp']]],
      ),
  },
  {
    dir: 'mcp/startup-timed',
    tiers: ['fake', 'docker'],
    env: 'stamp',
    canaryEnv: 'crashing',
    canary: zeroBy('observed:start-ms'),
    record: ({ run }) => {
      const startup = (name: string) =>
        run.evals.find((e) => e.name === name)?.attempts[0]?.turns.map((t) => t.mcpStartup)
      const [[lands] = []] = startup('lands') ?? []
      assert.equal(lands?.server, 'stamp')
      assert.equal(typeof lands?.ms, 'number', JSON.stringify(lands))
      assert.deepEqual(startup('canary'), [[{ server: 'stamp', ms: null }]])
    },
  },
  {
    dir: 'mcp/never-answers',
    tiers: ['docker'],
    env: 'silent',
    canaryEnv: 'quick',
    lands: {
      outcome: 'infra_error',
      error: { kind: 'infra', message: /^MCP server stamp didn't answer initialize within 60s$/ },
    },
    canary: zeroBy('timed-out'),
    canaryGraded: { 'timed-out': 'completed' },
    record: ({ run }) => {
      const [turn] = landed(run)?.turns ?? []
      assert.deepEqual(turn?.mcpStartup, [{ server: 'stamp', ms: null }])
      assert.equal(turn?.status, 'error')
      assert.equal(turn?.error, "MCP server stamp didn't answer initialize within 60s")
    },
  },
  {
    dir: 'secrets/checks-hidden-from-agent',
    tiers: ['fake', 'docker'],
    env: 'tokens',
    hostEnv: { REEVAL_FIXTURE_TOKEN: TOKEN },
    canary: zeroBy('observed:agent-sees-checks-value'),
    canarySaw: { 'agent-saw': 'unset\n' },
    record: ({ runDir }) => assert.equal(filesContaining(runDir, TOKEN), ''),
  },
  {
    dir: 'secrets/checks-visible-to-checks',
    tiers: ['fake', 'docker'],
    env: 'tokens',
    hostEnv: { REEVAL_FIXTURE_TOKEN: TOKEN },
    canary: zeroBy('observed:checks-saw-nothing'),
    canarySaw: { 'checks-saw': '[REDACTED]' },
    record: ({ runDir }) => assert.equal(filesContaining(runDir, TOKEN), ''),
  },
  {
    dir: 'secrets/grade-masked',
    tiers: ['fake'],
    env: 'tokens',
    hostEnv: { REEVAL_FIXTURE_TOKEN: TOKEN },
    canary: /: thrower errored: bad \[REDACTED\]$/,
    record: ({ run, project, runDir, stdout }) => {
      const grades = landed(run)?.grades?.map((g) => [g.grader, g.grade, g.error])
      assert.deepEqual(grades, [
        ['value', 'token [REDACTED]', undefined],
        ['from-exec', '[REDACTED]', undefined],
        ['thrower', undefined, 'bad [REDACTED]'],
      ])
      assert.equal(filesContaining(runDir, TOKEN), '')
      assert.equal(filesContaining(join(project, '.reeval'), TOKEN), '')
      assert.ok(!stdout.includes(TOKEN), 'the terminal output has the token')
    },
  },
  {
    dir: 'secrets/file-sandbox-agent-sees-value',
    tiers: ['fake', 'docker'],
    env: 'keys',
    hostEnv: (dir) => ({
      ...secretsFile(dir, { API_KEY: { mode: 'sandbox', value: TOKEN } }),
      REEVAL_FIXTURE_TOKEN: TOKEN,
    }),
    canary: zeroBy('observed:sees-placeholder'),
    canarySaw: { 'agent-saw': '[REDACTED]' },
    record: ({ project, runDir }) => {
      assert.equal(existsSync(join(project, SECRETS_JSON)), false, 'reeval deleted the file')
      assert.equal(filesContaining(runDir, TOKEN), '')
    },
  },
  {
    dir: 'secrets/file-sandbox-hidden-from-eval',
    tiers: ['fake'],
    env: 'keys',
    hostEnv: (dir) => secretsFile(dir, { API_KEY: { mode: 'sandbox', value: TOKEN } }),
    canary: zeroBy('observed:reads-placeholder'),
    canarySaw: { 'reads-placeholder': true },
    record: ({ runDir }) => assert.equal(filesContaining(runDir, TOKEN), ''),
  },
  {
    dir: 'secrets/file-brokered-warning',
    tiers: ['docker'],
    env: 'keys',
    args: ['--events-file', 'events.ndjson'],
    hostEnv: (dir) => ({
      ...egressEnv(),
      ...secretsFile(dir, {
        API_KEY: { mode: 'brokered', hosts: [egressTarget.host], value: TOKEN },
        OTHER_KEY: { mode: 'brokered', hosts: ['api.example.com'], value: AGENT_VALUE },
      }),
    }),
    canary: zeroBy('observed:key'),
    canarySaw: { key: /^reeval_secret_/ },
    record: ({ run, project }) => {
      const key = landed(run)?.key ?? ''
      const expected = [
        { secret: 'API_KEY', host: egressTarget.host, reason: 'plain_http' },
        { secret: 'OTHER_KEY', host: egressTarget.host, reason: 'host_not_allowed' },
      ]
      assert.deepEqual(landed(run)?.secretWarnings, expected)
      assert.deepEqual(
        run.secretWarnings?.filter((w) => w.attemptId === key),
        expected.map((w) => ({ ...w, attemptId: key })),
      )
      const events = readFileSync(join(project, 'events.ndjson'), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as { type?: string; attemptId?: string })
        .filter((e) => e.type === 'secret-warning' && e.attemptId === key)
        .map(({ type, secret, host, reason }: Record<string, unknown>) => ({
          type,
          secret,
          host,
          reason,
        }))
      assert.deepEqual(
        events,
        expected.map((w) => ({ type: 'secret-warning', ...w })),
      )
      const state = join(project, '.reeval')
      assert.equal(filesContaining(state, TOKEN), '')
      assert.equal(filesContaining(state, AGENT_VALUE), '')
    },
  },
  {
    dir: 'secrets/judge-sees-redacted',
    tiers: ['fake', 'docker'],
    env: 'tokens',
    hostEnv: { REEVAL_FIXTURE_TOKEN: TOKEN, REEVAL_FIXTURE_AGENT_VALUE: AGENT_VALUE },
    canary: zeroBy('sees-redacted'),
    record: ({ run, project, runDir }) => {
      assert.ok(existsSync(join(project, 'judge-saw-lands.json')), 'the judge was called')
      assert.equal(judgeGradeOf(run).score, 1)
      assert.equal(filesContaining(runDir, TOKEN), '')
      assert.equal(filesContaining(runDir, AGENT_VALUE), '')
    },
  },
  {
    dir: 'secrets/brokered-agent-sees-placeholder',
    tiers: ['fake', 'docker', 'podman'],
    env: 'keys',
    hostEnv: { REEVAL_FIXTURE_TOKEN: TOKEN },
    canary: zeroBy('observed:key-is-host-value'),
    canarySaw: { 'agent-saw': /^reeval_secret_[0-9A-Za-z]+$/ },
    record: ({ run, runDir }) => {
      assert.deepEqual(landed(run)?.env.brokered, ['API_KEY'])
      assert.equal(filesContaining(runDir, TOKEN), '')
      assert.notEqual(filesContaining(runDir, 'API_KEY'), '', 'twin: the search finds the name')
    },
  },
  {
    dir: 'sandbox/boat-session',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeBoat,
    hostEnv: () => ({
      BOAT_BASE_URL: boatApi.url,
      BOAT_API_KEY: boatApi.key,
      REEVAL_SANDBOX_LABELS: 'sweep-job=job_42',
    }),
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["reeval"/ },
    record: ({ run }) => {
      boatCleanedUp(run)
      const prefix = runPrefix(boat(), run.runId)
      const creates = boatApi.requests.filter(
        (q) => q.call === 'POST /sandboxes' && String(q.body?.name).startsWith(prefix),
      )
      for (const q of creates) {
        assert.deepEqual(q.body?.labels, { 'sweep-job': 'job_42', ...runLabels(boat(), run.runId) })
      }
    },
  },
  {
    dir: 'sandbox/boat-heartbeat',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeBoat,
    hostEnv: () => ({
      BOAT_BASE_URL: boatApi.url,
      BOAT_API_KEY: boatApi.key,
      REEVAL_EVENTS_HEARTBEAT: '1s',
    }),
    args: ['--events-file', 'events.ndjson'],
    canary: zeroBy('observed:hold'),
    canarySaw: { hold: 'held' },
    record: ({ run, project }) => {
      boatCleanedUp(run)
      const machine = run.evals.find((e) => e.name === 'lands')?.attempts[0]?.resources?.machine.id
      assert.match(machine ?? '', /^bx_[0-9a-f]{8}$/)
      const beats = readFileSync(join(project, 'events.ndjson'), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as RunEventLine)
        .flatMap((l) => (l.type === 'heartbeat' && l.attempts ? [l] : []))
      const holding = beats.filter((b) => b.attempts?.some((a) => a.machine === machine))
      assert.ok(holding.length >= 1, JSON.stringify(beats))
      for (const b of holding) assert.ok(b.machines?.includes(machine ?? ''), JSON.stringify(b))
      assert.deepEqual(beats.at(-1)?.attempts, [])
      assert.equal(beats.at(-1)?.done, true)
    },
  },
  {
    dir: 'sandbox/boat-resources',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeBoat,
    canary: zeroBy('observed:cpus'),
    canarySaw: { cpus: (cpus) => typeof cpus === 'number' && cpus > 0 },
    record: ({ run }) => {
      boatCleanedUp(run)
      const r = run.evals.find((e) => e.name === 'lands')?.attempts[0]?.resources
      assert.equal(r?.scope, 'container', JSON.stringify(r))
      assert.equal(r?.machine.sandbox, 'boat')
      assert.equal(r?.machine.size, 'small')
      assert.match(r?.machine.id ?? '', /^bx_[0-9a-f]{8}$/, JSON.stringify(r))
      assert.ok(r?.machine.name?.startsWith(runPrefix(boat(), run.runId)), JSON.stringify(r))
      assert.ok(
        boatApi.requests.some((q) => q.call === `DELETE /sandboxes/${r?.machine.id}`),
        'the recorded id is the sandbox reeval deleted',
      )
      assert.ok((r?.machine.vcpus ?? 0) >= 1, JSON.stringify(r))
      assert.ok((r?.machine.memoryBytes ?? 0) > 0, JSON.stringify(r))
      assert.ok((r?.usage?.cpuSeconds ?? 0) >= 1.5, JSON.stringify(r))
      assert.ok((r?.usage?.peakCores ?? 0) >= (r?.usage?.avgCores ?? 1), JSON.stringify(r))
      assert.ok((r?.usage?.peakMemoryBytes ?? 0) > 0, JSON.stringify(r))
      assert.equal(r?.usage?.diskReadBytes, undefined, "Docker's stats, as a local container's")
      assert.ok((r?.usage?.p95Cores ?? 99) <= (r?.usage?.peakCores ?? 0), JSON.stringify(r))
      assert.ok(r?.usage?.throttling, 'the container has a cgroup of its own')
    },
  },
  {
    dir: 'sandbox/boat-brokered',
    tiers: ['docker'],
    env: 'keys',
    ...onFakeBoat,
    hostEnv: () => ({
      BOAT_BASE_URL: boatApi.url,
      BOAT_API_KEY: boatApi.key,
      REEVAL_FIXTURE_TOKEN: TOKEN,
    }),
    canary: zeroBy('observed:key-is-host-value'),
    canarySaw: { 'agent-saw': /^reeval_secret_[0-9A-Za-z]+$/ },
    record: ({ run, runDir }) => {
      assert.deepEqual(landed(run)?.env.brokered, ['API_KEY'])
      assert.equal(filesContaining(runDir, TOKEN), '')
      boatCleanedUp(run)
    },
  },
  {
    dir: 'sandbox/boat-serve',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeBoat,
    canary: zeroBy('observed:left'),
    canarySaw: { left: /^[1-9]\d*$/ },
    record: ({ run }) => boatCleanedUp(run),
  },
  {
    dir: 'sandbox/boat-pool-reuse',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeBoat,
    prepare: async (dir) => {
      await buildOnFakeBoat(dir)
      boatApi.refuseStarts(1, { namePrefix: 'pool-' })
    },
    args: ['--concurrency', '1'],
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["home-clean"/ },
    record: ({ run, runDir }) => {
      const sandbox = createBoat({ prefix: 'pool' })()
      const prefix = runPrefix(sandbox, run.runId)
      assert.ok(
        boatApi.requests.some((q) => q.refused && String(q.body?.name).startsWith(prefix)),
        'the refused start was retried, not failed',
      )
      assert.equal(boatCreates(run, sandbox), 1, 'both attempts ran on one machine')
      // Whichever attempt ran second, the canary's or lands', found nothing the first left.
      const saw = run.evals.map((e) => {
        const path = e.attempts[0]?.files.trajectory?.path ?? ''
        const shell = readFileSync(join(runDir, path), 'utf8')
          .trim()
          .split('\n')
          .map((l) => JSON.parse(l))
          .find((t) => t.type === 'tool' && t.tool === 'shell')
        return String(shell?.output).split('\n').slice(0, 3).join(' ')
      })
      assert.deepEqual(saw, ['home-clean tmp-clean proc-clean', 'home-clean tmp-clean proc-clean'])
      boatCleanedUp(run, sandbox)
    },
  },
  {
    dir: 'sandbox/boat-shared-machine',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeBoat,
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["reeval"/ },
    record: ({ run }) => {
      assert.equal(boatCreates(run), 1, 'both attempts ran at once on one machine')
      boatCleanedUp(run)
      const resources = run.evals.flatMap((e) => e.attempts.map((a) => a.resources))
      assert.ok(resources.length >= 2, JSON.stringify(resources))
      for (const r of resources) {
        assert.equal(r?.scope, 'container', JSON.stringify(r))
        assert.equal(r?.machine.sandbox, 'boat')
        assert.ok((r?.machine.vcpus ?? 0) >= 1, JSON.stringify(r))
        assert.ok(r?.usage, "each attempt's own container's use")
      }
    },
  },
  {
    dir: 'sandbox/boat-image',
    tiers: ['docker'],
    env: 'closed',
    canaryEnv: 'open',
    ...onFakeBoat,
    // The run builds its own snapshot: no `reeval image build` first.
    prepare: () => buildSshVmImage(['boat', 'boat-docker']),
    sandbox: `docker${installId(['echo baked-by-boat-image > /etc/reeval-recipe'])}`,
    hostEnv: () => ({ BOAT_BASE_URL: boatApi.url, BOAT_API_KEY: boatApi.key, ...egressEnv() }),
    canary: zeroBy('observed:direct'),
    canarySaw: { direct: '200 exit=0' },
    record: ({ run }) => {
      boatCleanedUp(run)
      const attempt = landed(run)
      const base = attempt?.sandboxBase
      assert.equal(base?.provider, 'boat', JSON.stringify(attempt))
      assert.match(base?.snapshot ?? '', /^reeval-img-[0-9a-f]{12}$/)
      assert.equal(base?.image, `reeval-vm-image:${base?.key.slice(0, 12)}`)
      assert.equal(base?.built, true, 'built by this run')
      const prefix = runPrefix(boat(), run.runId)
      const creates = boatApi.requests.filter(
        (q) => q.call === 'POST /sandboxes' && String(q.body?.name).startsWith(prefix),
      )
      assert.ok(creates.length > 0)
      for (const q of creates)
        assert.equal(q.body?.from, base?.snapshot, 'started from the snapshot')
      assert.equal(attempt?.resources?.scope, 'container', JSON.stringify(attempt?.resources))
      assert.equal(attempt?.resources?.machine.sandbox, 'boat')
      assert.deepEqual(attempt?.egress?.blocked, [
        {
          host: egressTarget.host,
          port: egressTarget.port,
          connections: 1,
          reason: 'the policy denies all egress',
        },
      ])
    },
  },
  {
    dir: 'sandbox/cloud-image',
    tiers: ['docker'],
    env: 'closed',
    canaryEnv: 'open',
    sandbox: `cloud${installId(['echo baked-by-cloud-image > /etc/reeval-recipe'])}`,
    hostEnv: () => ({
      REEVAL_VM_URL: vmService.url,
      REEVAL_VM_TOKEN: vmService.token,
      ...egressEnv(),
    }),
    prepare: () => buildSshVmImage(['boat', 'boat-docker']),
    canary: zeroBy('observed:direct'),
    canarySaw: { direct: '200 exit=0' },
    record: ({ run }) => {
      const prefix = runPrefix(CLOUD_VM, run.runId)
      assert.deepEqual(
        dockerBoatApi.live().filter((name) => name.startsWith(prefix)),
        [],
        'every VM of the run is deleted',
      )
      const creates = dockerBoatApi.requests.filter(
        (q) => q.call === 'POST /sandboxes' && String(q.body?.name).startsWith(prefix),
      )
      assert.ok(creates.length > 0, 'the run created its VMs on the service')
      for (const q of creates) assert.equal(q.body?.from, undefined, 'no snapshot to start from')
      const attempt = landed(run)
      assert.equal(attempt?.resources?.scope, 'container', JSON.stringify(attempt?.resources))
      assert.equal(attempt?.resources?.machine.sandbox, 'cloud')
      assert.equal(attempt?.resources?.machine.size, 'small')
      const image = run.stack.images.find((i) => i.id === attempt?.imageId)
      assert.match(image?.ref ?? '', /^reeval-install:/, JSON.stringify(run.stack.images))
      assert.deepEqual(image?.install, ['echo baked-by-cloud-image > /etc/reeval-recipe'])
      assert.deepEqual(attempt?.egress?.blocked, [
        {
          host: egressTarget.host,
          port: egressTarget.port,
          connections: 1,
          reason: 'the policy denies all egress',
        },
      ])
    },
  },
  {
    dir: 'sandbox/cloud-fan-out',
    tiers: ['docker'],
    env: '-',
    hostEnv: () => ({
      REEVAL_PLAN_TARGET: 'cloud',
      REEVAL_VM_URL: vmService.url,
      REEVAL_VM_TOKEN: vmService.token,
    }),
    prepare: () => buildSshVmImage(['boat', 'boat-docker']),
    canary: zeroBy('observed:shell-output'),
    canarySaw: { 'shell-output': 'root\n' },
    evals: {
      lands: { outcome: 'pass', attempts: ['fake/-/docker#1', 'fake/-/docker#2'] },
      canary: {
        outcome: 'fail',
        attempts: ['fake/-/docker#1'],
        error: { kind: 'assertion', message: zeroBy('observed:shell-output') },
      },
    },
    record: ({ run }) => {
      const prefix = runPrefix(CLOUD_VM, run.runId)
      assert.deepEqual(
        dockerBoatApi.live().filter((name) => name.startsWith(prefix)),
        [],
        'every VM of the run is deleted',
      )
      const attempts = run.evals.flatMap((e) => e.attempts)
      const machines = attempts.map((a) => a.resources?.machine)
      for (const [i, a] of attempts.entries()) {
        assert.equal(a.resources?.scope, 'container', JSON.stringify(a.resources))
        assert.equal(machines[i]?.sandbox, 'cloud', 'on a VM, not the machine that ran the run')
        const image = run.stack.images.find((im) => im.id === a.imageId)
        assert.match(image?.ref ?? '', /^reeval-sandbox:/, "reeval's image for the harness")
      }
      assert.equal(
        new Set(machines.map((m) => m?.id)).size,
        attempts.length,
        `each attempt on a VM of its own: ${JSON.stringify(machines)}`,
      )
    },
  },
  {
    dir: 'sandbox/cloud-plugin-build',
    tiers: ['docker'],
    env: 'built',
    hostEnv: () => ({
      REEVAL_PLAN_TARGET: 'cloud',
      REEVAL_VM_URL: vmService.url,
      REEVAL_VM_TOKEN: vmService.token,
    }),
    prepare: () => buildSshVmImage(['boat', 'boat-docker']),
    canary: zeroBy('observed:built.txt'),
    canarySaw: { 'built.txt': '' },
    record: ({ run }) => {
      const [p] = plugins(run)
      assert.equal(p?.name, 'built')
      assert.match(p?.build ?? '', /^reeval-plugin:[0-9a-f]{12}-[0-9a-f]{16}$/)
      const r = run.evals.find((e) => e.name === 'lands')?.attempts[0]?.resources
      assert.equal(r?.machine.sandbox, 'cloud', 'built on a VM, not the machine that ran the run')
    },
  },
  {
    dir: 'sandbox/cloud-session',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeCloud,
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["reeval"/ },
    record: ({ run, project }) => {
      cloudCleanedUp(run, project)
      const r = run.evals.find((e) => e.name === 'lands')?.attempts[0]?.resources
      assert.equal(r?.scope, 'container', JSON.stringify(r))
      assert.equal(r?.machine.sandbox, 'cloud')
      assert.equal(r?.machine.size, 'small')
      assert.match(r?.machine.id ?? '', /^bx_[0-9a-f]{8}$/, JSON.stringify(r))
      assert.ok(r?.machine.name?.startsWith(runPrefix(CLOUD_VM, run.runId)), JSON.stringify(r))
    },
  },
  {
    dir: 'sandbox/cloud-shared-machine',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeCloud,
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["reeval"/ },
    record: ({ run, project }) => {
      assert.equal(
        boatCreates(run, CLOUD_VM, dockerBoatApi),
        1,
        'both attempts ran at once on one machine',
      )
      cloudCleanedUp(run, project)
      const resources = run.evals.flatMap((e) => e.attempts.map((a) => a.resources))
      assert.ok(resources.length >= 2, JSON.stringify(resources))
      for (const r of resources) {
        assert.equal(r?.scope, 'container', JSON.stringify(r))
        assert.equal(r?.machine.sandbox, 'cloud')
        assert.ok(r?.usage, "each attempt's own container's use")
      }
    },
  },
  {
    dir: 'sandbox/daytona-session',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeDaytona,
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["reeval"/ },
    record: ({ run }) => {
      daytonaCleanedUp(run)
      for (const s of daytonaCreated(run)) {
        assert.match(String(s.snapshot), /^reeval-img-[0-9a-f]{12}$/, "reeval's image")
        assert.ok(s.ttlMinutes > 0, 'each sandbox has a TTL, in case the run never deletes it')
      }
    },
  },
  {
    dir: 'sandbox/daytona-image',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeDaytona,
    sandbox: 'docker:debian:bookworm-slim+cd073bbf',
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["reeval(-s1)?"/ },
    record: ({ run, project }) => {
      const recipe = daytona({
        from: 'debian:bookworm-slim',
        install: ['echo installed > /etc/reeval-install-proof'],
        attemptsPerMachine: 2,
      })
      daytonaCleanedUp(run, recipe)
      const made = daytonaCreated(run, recipe)
      const [snapshot, ...others] = new Set(made.map((s) => s.snapshot))
      assert.equal(others.length, 0, 'every sandbox starts from the one snapshot')
      assert.match(String(snapshot), /^reeval-img-[0-9a-f]{12}$/)
      const built = daytonaApi.snapshots().find((s) => s.name === snapshot)
      assert.equal(built?.state, 'active')
      assert.match(String(built?.dockerfile), /^FROM debian:bookworm-slim@sha256:/)
      const logs = debugLogs(project).flat()
      assert.ok(
        logs.some((l) => l.includes(`starts each attempt from ${snapshot}, which has the harness`)),
        'the debug log names the image each attempt started from',
      )
      assert.ok(
        !logs.some((l) => /installed the fake agent's bootstrap/.test(l)),
        "the attempt didn't install the harness again",
      )
    },
  },
  {
    dir: 'sandbox/daytona-image-env',
    tiers: ['docker'],
    env: 'image',
    canaryEnv: 'stock',
    ...onFakeDaytona,
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': [''] },
  },
  {
    dir: 'sandbox/daytona-resources',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeDaytona,
    canary: zeroBy('observed:cpus'),
    canarySaw: { cpus: (cpus) => typeof cpus === 'number' && cpus > 0 },
    record: ({ run }) => {
      daytonaCleanedUp(run)
      const r = run.evals.find((e) => e.name === 'lands')?.attempts[0]?.resources
      assert.equal(r?.scope, 'machine', JSON.stringify(r))
      assert.equal(r?.machine.sandbox, 'daytona')
      assert.equal(r?.machine.size, 'medium')
      const made = daytonaCreated(run).map((s) => s.name)
      assert.ok(made.includes(r?.machine.name ?? ''), JSON.stringify(r))
      assert.ok(
        daytonaApi.requests.some((q) => q.call === `DELETE /sandbox/${r?.machine.id}`),
        'the recorded id is the sandbox reeval deleted',
      )
      // The sandbox's own limits, not the host's /proc.
      assert.equal(r?.machine.vcpus, DAYTONA_VM_SIZE.vcpus, JSON.stringify(r))
      assert.equal(r?.machine.memoryBytes, DAYTONA_VM_SIZE.memoryBytes, JSON.stringify(r))
      assert.ok((r?.usage?.cpuSeconds ?? 0) >= 1.5, JSON.stringify(r))
      assert.ok((r?.usage?.cpuSeconds ?? 99) < 30, JSON.stringify(r))
      assert.ok((r?.usage?.peakMemoryBytes ?? 0) > 0, JSON.stringify(r))
      assert.ok(r?.usage?.throttling, JSON.stringify(r))
    },
  },
  {
    dir: 'sandbox/daytona-pool-reuse',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeDaytona,
    prepare: async () => {
      await buildSshVmImage()
      daytonaApi.refuseStarts(1, { namePrefix: 'pool-' })
    },
    args: ['--concurrency', '1'],
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["home-clean"/ },
    record: ({ run }) => {
      const sandbox = createDaytona({ prefix: 'pool' })()
      assert.ok(
        daytonaApi.requests.some((q) => q.refused && String(q.body?.name).startsWith('pool-')),
        'the refused start was retried, not failed',
      )
      assert.equal(daytonaCreated(run, sandbox).length, 1, 'both attempts ran on one machine')
      daytonaCleanedUp(run, sandbox)
    },
  },
  {
    dir: 'sandbox/daytona-shared-machine',
    tiers: ['docker'],
    env: 'vm',
    ...onFakeDaytona,
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["reeval(-s1)?"/ },
    record: ({ run }) => {
      assert.equal(daytonaCreated(run).length, 1, 'both attempts ran at once on one machine')
      daytonaCleanedUp(run)
      const resources = run.evals.flatMap((e) => e.attempts.map((a) => a.resources))
      assert.ok(resources.length >= 2, JSON.stringify(resources))
      for (const r of resources) {
        assert.equal(r?.scope, 'machine', JSON.stringify(r))
        assert.equal(r?.shared, true, JSON.stringify(r))
        assert.equal(r?.machine.sandbox, 'daytona')
        assert.equal(r?.usage, undefined, "another attempt's use would count in the VM's")
      }
    },
  },
  {
    dir: 'secrets/brokered-checks-see-placeholder',
    tiers: ['fake', 'docker'],
    env: 'keys',
    hostEnv: { REEVAL_FIXTURE_TOKEN: TOKEN },
    canary: zeroBy('observed:sees-host-value'),
    canarySaw: { 'checks-saw': /^reeval_secret_[0-9A-Za-z]+$/ },
    record: ({ run, runDir }) => {
      assert.deepEqual(landed(run)?.env, {
        vars: [],
        secrets: ['CHECK_TOKEN'],
        brokered: ['CHECK_TOKEN'],
      })
      assert.equal(filesContaining(runDir, TOKEN), '')
      assert.notEqual(filesContaining(runDir, 'CHECK_TOKEN'), '', 'twin: the search finds the name')
    },
  },
  {
    dir: 'secrets/exec-env-brokered',
    tiers: ['fake', 'docker'],
    env: 'keys',
    hostEnv: { REEVAL_FIXTURE_TOKEN: TOKEN },
    canary: zeroBy('observed:sees-host-value'),
    canarySaw: { 'command-saw': /^Bearer reeval_secret_[0-9A-Za-z]+$/ },
    record: ({ runDir }) => {
      assert.equal(filesContaining(runDir, TOKEN), '')
    },
  },
  {
    dir: 'secrets/exec-env-masked',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: /\+ '\[REDACTED\]'\n- 'not the token'/,
    record: ({ project, runDir, stdout }) => {
      const token = ['exec', 'env', '7f3a9c', '41d2b8'].join('-')
      assert.equal(filesContaining(runDir, token), '')
      assert.equal(filesContaining(join(project, '.reeval'), token), '')
      assert.ok(!stdout.includes(token), 'the terminal output has the token')
      // Twin: the same search finds what was left in its place.
      assert.notEqual(filesContaining(runDir, '[REDACTED]'), '')
    },
  },
  {
    dir: 'secrets/checks-setup-background',
    tiers: ['docker'],
    env: 'unbrokered',
    canaryEnv: 'brokered',
    hostEnv: { REEVAL_FIXTURE_TOKEN: TOKEN },
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': 'placeholder' },
    record: ({ run, runDir, stdout }) => {
      const byCommand = (a: { command: string }, b: { command: string }) =>
        a.command.localeCompare(b.command)
      assert.deepEqual(landed(run)?.setupProcesses?.toSorted(byCommand), [
        { command: 'sh -c sleep 601; : one two', secrets: ['CHECK_TOKEN'] },
        { command: 'sleep 600', secrets: ['CHECK_TOKEN'] },
        { command: 'sleep 601', secrets: ['CHECK_TOKEN'] },
      ])
      assert.match(
        stdout,
        /Setup left "[^"]+" \(and 2 more\) running with CHECK_TOKEN, a to: 'checks' secret without hosts, in their environment, so the agent can read the real value from those processes\./,
      )
      // Twin: brokered with hosts, the same process holds a placeholder and nothing is recorded.
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]
      assert.ok(canary)
      assert.equal(canary.setupProcesses, undefined)
      assert.equal(filesContaining(runDir, TOKEN), '')
    },
  },
  {
    dir: 'secrets/checks-setup-finishes',
    tiers: ['docker'],
    env: 'finishes',
    hostEnv: { REEVAL_FIXTURE_TOKEN: TOKEN },
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': '' },
    record: ({ run, stdout }) => {
      assert.ok(landed(run)?.files.setupLog, 'the setup step ran')
      assert.equal(landed(run)?.setupProcesses, undefined)
      assert.doesNotMatch(stdout, /Setup left/)
    },
  },
  {
    dir: 'secrets/cursor-session-tokens',
    tiers: ['real'],
    env: 'plain',
    canary: zeroBy('observed:signature'),
    canarySaw: { signature: '' },
  },
  {
    dir: 'secrets/redaction-coverage',
    tiers: ['fake', 'docker'],
    env: 'leaky',
    hostEnv: { REEVAL_FIXTURE_LEAKY: LEAKY },
    canary: /leak\.txt holds \[REDACTED\]/,
    async record({ project, runDir, tier }) {
      const env = { REEVAL_FIXTURE_LEAKY: LEAKY, REEVAL_FIXTURE_SANDBOX: tier }
      const recorded = await runCli(project, ['record'], { env })
      assert.equal(recorded.code, 0, recorded.stdout + recorded.stderr)
      const site = join(project, 'site')
      await writeStudioResponses(studioSource(project), site)
      const judgeSaw = join(project, 'judge-saw.json')
      const sent = JSON.parse(readFileSync(judgeSaw, 'utf8')) as { diff?: string }
      assert.match(sent.diff ?? '', /leak\.txt/, 'the judge saw the diff')
      for (const [where, paths] of [
        ['the run', [runDir]],
        ['the history folder', [join(project, 'evals', '.history')]],
        ['the studio', [site]],
        ['what the judge was sent', [judgeSaw]],
      ] as const) {
        for (const form of leakyForms()) {
          const hits = paths.map((p) => filesContaining(p, form)).join('')
          assert.equal(hits, '', `${where} has ${JSON.stringify(form)}`)
        }
        // Twin: the same search finds what was left in place of the forms.
        const masked = paths.map((p) => filesContaining(p, '[REDACTED]')).join('')
        assert.notEqual(masked, '', `${where} has no [REDACTED]`)
      }
    },
  },
  {
    dir: 'secrets/masked-eval-names',
    tiers: ['fake'],
    env: 'plain',
    canary: zeroBy('observed:gets-the-case-masked'),
    canarySaw: { 'gets-the-key': true },
    evals: {
      lands: { outcome: 'pass', attempts: ['fake/plain/fake#[REDACTED]#1'] },
      canary: {
        outcome: 'fail',
        attempts: ['fake/plain/fake#[REDACTED]#1'],
        error: { kind: 'assertion', message: zeroBy('observed:gets-the-case-masked') },
      },
    },
    async record({ run, project, runDir, stdout }) {
      assert.deepEqual(
        run.evals.map((e) => [e.id, e.cases?.map((k) => k.key)]),
        [
          ['canary', ['[REDACTED]']],
          ['lands', ['[REDACTED]']],
        ],
      )
      const recorded = await runCli(project, ['record'])
      assert.equal(recorded.code, 0, recorded.stdout + recorded.stderr)
      const site = join(project, 'site')
      await writeStudioResponses(studioSource(project), site)
      const history = await runCli(project, ['history'])
      assert.match(history.stdout, /lands/)
      const runs = join(project, '.reeval', 'runs')
      for (const [where, text] of [
        ['the terminal', stdout],
        ['`reeval history`', history.stdout],
        ['the runs folder', filesContaining(runs, 'sk-ant-')],
        ['the history folder', filesContaining(join(project, 'evals', '.history'), 'sk-ant-')],
        ['the studio', filesContaining(site, 'sk-ant-')],
      ] as const) {
        assert.doesNotMatch(text, /sk-ant-|reeval-fixture-not-a-key/, `${where} has the key`)
      }
      // Twin: the same search finds the masked case in the Attempt index.
      assert.notEqual(filesContaining(runDir, 'plain / [REDACTED]'), '')
    },
  },
  {
    dir: 'secrets/short-declared-secrets',
    tiers: ['fake', 'docker'],
    env: 'pins',
    hostEnv: { REEVAL_FIXTURE_PIN: '1234', REEVAL_FIXTURE_PLACEHOLDER: 'null' },
    canary: zeroBy('observed:checks-saw-values'),
    canarySaw: { 'checks-saw': '[REDACTED]\n[REDACTED]\n' },
    async record({ run, project, runDir }) {
      const attempt = landed(run)
      assert.equal(attempt?.error, null)
      const lines = readFileSync(join(runDir, attempt?.files.trajectory?.path ?? ''), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
      const edit = lines.find((e) => e.type === 'file-edit' && e.path.endsWith('pins.txt'))
      assert.equal(edit?.added, 1234)
      const shell = lines.find((e) => e.type === 'tool' && e.tool === 'shell')
      assert.equal(shell?.output, '[REDACTED]\n[REDACTED]\n')
      // Diff/line totals can equal PIN=1234; --skip-secret-scan keeps that false positive from refusing.
      const recorded = await runCli(project, ['record', '--skip-secret-scan'])
      assert.equal(recorded.code, 0, recorded.stdout + recorded.stderr)
      const history = join(project, 'evals', '.history')
      assert.ok(existsSync(join(history, `${run.runId}.json`)), 'the run was recorded')
    },
  },
  {
    dir: 'egress/allowed-host-reachable',
    tiers: ['docker', 'podman'],
    env: 'listed',
    canaryEnv: 'closed',
    hostEnv: egressEnv,
    canary: zeroBy('reaches-the-listener'),
    canaryGraded: { 'reaches-the-listener': /^\["blocked by the reeval egress policy: / },
    record: ({ run }) => {
      const egress = landed(run)?.egress
      assert.deepEqual(egress?.policy, { allow: [egressTarget.host] })
      assert.deepEqual(egress?.allowed, [egressTarget.host])
      const [reached, ...more] = egress?.contacted ?? []
      assert.deepEqual(
        [reached?.host, reached?.port, reached?.connections, more],
        [egressTarget.host, egressTarget.port, 1, []],
      )
      assert.ok((reached?.sent ?? 0) > 0 && (reached?.received ?? 0) > 'reeval-egress-ok'.length)
      assert.deepEqual(egress?.blocked, [])
    },
  },
  {
    dir: 'egress/blocked-host-recorded',
    tiers: ['docker', 'podman'],
    env: 'listed',
    canary: zeroBy('not-refused'),
    canaryGraded: { 'not-refused': /^\["blocked by the reeval egress policy: / },
    record: ({ run }) =>
      assert.deepEqual(landed(run)?.egress, {
        policy: { allow: ['api.example.com'] },
        allowed: ['api.example.com'],
        recorded: true,
        contacted: [],
        blocked: [
          {
            host: 'blocked.invalid',
            port: 80,
            connections: 1,
            reason: "blocked.invalid isn't in the allowlist",
          },
        ],
        expectedBlocked: [],
        unresolved: [],
      }),
  },
  {
    dir: 'egress/unresolved-host-recorded',
    tiers: ['docker', 'podman'],
    env: 'proxied',
    canary: zeroBy('policy-refusal'),
    canaryGraded: { 'policy-refusal': /^\["reeval egress gateway can't resolve / },
    record: ({ run }) => {
      const egress = landed(run)?.egress
      assert.deepEqual(
        egress?.blocked,
        [
          {
            host: '169.254.169.254',
            port: 80,
            connections: 1,
            reason: '169.254.169.254 is a loopback or link-local address',
          },
        ],
        'only the policy refusal is blocked',
      )
      assert.deepEqual(
        egress?.unresolved.map((h) => [h.host, h.port, h.connections]),
        [['reeval-missing.invalid', 80, 1]],
      )
      assert.match(egress?.unresolved[0]?.reason ?? '', /^can't resolve reeval-missing\.invalid: /)
    },
  },
  {
    dir: 'egress/brokered-request-refused',
    tiers: ['docker'],
    env: 'brokered',
    image: 'codex',
    hostEnv: { OPENAI_API_KEY: BROKERED_KEY },
    canary: zeroBy('not-refused'),
    canaryGraded: { 'not-refused': /^\["reeval egress gateway: refused GET / },
    record: ({ run, project, stdout }) => {
      const egress = landed(run)?.egress
      assert.deepEqual(egress?.blocked, [
        {
          host: 'api.openai.com',
          port: 443,
          connections: 1,
          reason:
            "GET /v1/models carries a brokered credential, and it isn't one of the endpoints reeval brokers it for",
        },
      ])
      assert.deepEqual(
        egress?.contacted.map((h) => h.host),
        ['api.openai.com'],
        'the host was let through; the request on it was refused',
      )
      const warning =
        "warning: the egress gateway refused GET https://api.openai.com/v1/models: it carries OPENAI_API_KEY's placeholder and isn't one of the endpoints reeval brokers it for"
      assert.equal(
        stdout.split('\n').filter((l) => l.includes(warning)).length,
        2,
        'one warning per attempt, on the terminal',
      )
      // The record, trajectories and debug trace, with a twin: the same search finds the request.
      const state = join(project, '.reeval')
      assert.equal(filesContaining(state, BROKERED_KEY), '')
      assert.notEqual(filesContaining(state, '/v1/models'), '')
    },
  },
  {
    dir: 'egress/expected-blocked',
    tiers: ['docker'],
    env: 'closed',
    image: 'antigravity',
    canary: zeroBy('has-file:reached.txt'),
    record: ({ run }) => {
      const egress = landed(run)?.egress
      assert.deepEqual(
        egress?.blocked.map((h) => [h.host, h.port, h.connections]),
        [['blocked.invalid', 80, 1]],
        'only the host nothing expects is listed as blocked',
      )
      assert.deepEqual(
        egress?.expectedBlocked?.map((h) => [h.host, h.port, h.connections, h.reason]),
        [
          ['antigravity-unleash.goog', 443, 1, "antigravity-unleash.goog isn't in the allowlist"],
          ['play.googleapis.com', 443, 1, "play.googleapis.com isn't in the allowlist"],
        ],
      )
    },
  },
  {
    dir: 'egress/deny-all',
    tiers: ['docker', 'podman'],
    env: 'closed',
    canaryEnv: 'open',
    hostEnv: egressEnv,
    canary: zeroBy('no-route-out'),
    // A rootless Podman container resolves names only as far as the runner's own DNS answers.
    canaryGraded: (tier) => ({
      'no-route-out':
        tier === 'podman' ? /^\["200 exit=0\\n?","dns=\d+/ : /^\["200 exit=0\\n?","dns=0/,
    }),
    record: ({ run }) => {
      const egress = landed(run)?.egress
      assert.equal(egress?.policy, 'deny-all')
      assert.deepEqual(egress?.allowed, [])
      assert.deepEqual(egress?.contacted, [])
      assert.deepEqual(egress?.blocked, [
        {
          host: egressTarget.host,
          port: egressTarget.port,
          connections: 1,
          reason: 'the policy denies all egress',
        },
      ])
    },
  },
  {
    dir: 'egress/node-proxy-quiet',
    tiers: ['docker'],
    env: 'quiet',
    canaryEnv: 'loud',
    hostEnv: egressEnv,
    canary: zeroBy('prints-only-the-body'),
    canaryGraded: { 'prints-only-the-body': /^\["\(node:\d+\) \[UNDICI-EHPA\] Warning: En/ },
    record: ({ run }) => {
      const contacted = landed(run)?.egress?.contacted ?? []
      assert.deepEqual(
        contacted.map((c) => [c.host, c.port]),
        [[egressTarget.host, egressTarget.port]],
      )
    },
  },
  {
    dir: 'egress/proxy-no-direct-route',
    tiers: ['docker', 'podman'],
    env: 'proxied',
    canaryEnv: 'open',
    hostEnv: egressEnv,
    canary: zeroBy('no-network'),
    canaryGraded: { 'no-network': /^\["reeval-egress-ok exit=0/ },
    record: ({ run }) =>
      assert.deepEqual(landed(run)?.egress, {
        policy: 'proxy',
        allowed: null,
        recorded: true,
        contacted: [],
        blocked: [],
        expectedBlocked: [],
        unresolved: [],
      }),
  },
  {
    dir: 'egress/allow-all-direct',
    tiers: ['docker', 'podman'],
    env: 'open',
    canaryEnv: 'proxied',
    hostEnv: egressEnv,
    canary: zeroBy('reaches-directly'),
    canaryGraded: { 'reaches-directly': /Network is unreachable/ },
    record: ({ run }) => {
      // The connection reached the listener, but around the gateway: nothing records it.
      assert.deepEqual(landed(run)?.egress, {
        policy: 'allow-all',
        allowed: null,
        recorded: true,
        partial: true,
        contacted: [],
        blocked: [],
        expectedBlocked: [],
        unresolved: [],
      })
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]?.egress
      assert.equal(canary?.policy, 'proxy')
      assert.equal(canary?.partial, undefined)
    },
  },
  {
    dir: 'egress/setup-open-agent-closed',
    // Not on rootless Podman (4.9, with its netavark): any container leaving the bridge, at
    // creation or at the switch, can cut the others on it off from the host for seconds, and the
    // canary's allow-all container needs that route for a whole attempt.
    tiers: ['docker'],
    env: 'phased',
    canaryEnv: 'open',
    hostEnv: egressEnv,
    canary: zeroBy('phases'),
    canaryGraded: { phases: '200 exit=0 · 200 exit=0 · 200 exit=0' },
    record: ({ run }) => {
      const egress = landed(run)?.egress
      assert.equal(egress?.policy, 'deny-all')
      assert.deepEqual(egress?.setup, { policy: 'allow-all', allowed: null })
      assert.equal(egress?.partial, true)
      assert.deepEqual(egress?.contacted, [])
      // Each phase's refusal of the same host is its own entry.
      assert.deepEqual(egress?.blocked, [
        {
          host: egressTarget.host,
          port: egressTarget.port,
          connections: 1,
          reason: `${egressTarget.host} is a private or reserved address, which allow-all doesn't reach; list the address in an allowlist to reach it`,
          phase: 'setup',
        },
        {
          host: egressTarget.host,
          port: egressTarget.port,
          connections: 1,
          reason: 'the policy denies all egress',
          phase: 'agent',
        },
      ])
      const phased = run.environments.find((e) => e.name === 'phased')
      assert.equal(phased?.setupEgress, 'allow-all')
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]?.egress
      assert.equal(canary?.setup, undefined)
      assert.ok(canary?.blocked.every((h) => h.phase === undefined))
    },
  },
  {
    dir: 'egress/tunnel-closed-on-switch',
    tiers: ['docker'],
    env: 'closed',
    canaryEnv: 'kept',
    hostEnv: egressEnv,
    canary: zeroBy('tunnel-closed'),
    canaryGraded: { 'tunnel-closed': 'open' },
    record: ({ run, stdout }) => {
      const egress = landed(run)?.egress
      assert.deepEqual(egress?.blocked, [
        {
          host: egressTarget.host,
          port: egressTarget.port,
          connections: 1,
          reason: 'a tunnel opened before the agent phase, closed: the policy denies all egress',
          phase: 'agent',
          closed: true,
        },
      ])
      const kept = run.evals.find((e) => e.name === 'canary')?.attempts[0]?.egress
      assert.deepEqual(kept?.blocked, [])
      assert.match(
        stdout,
        /Setup left a connection open to [\d.]+:\d+, which the agent's egress refuses, so reeval closed it/,
      )
    },
  },
  {
    dir: 'egress/switch-after-setup',
    tiers: ['fake', 'docker'],
    env: 'phased',
    canary: zeroBy('reads-nothing'),
    canaryGraded: { 'reads-nothing': /^\["ready\\n?"\]$/ },
    record: ({ project }) => {
      const logs = debugLogs(project)
      assert.ok(logs.length > 0, 'no debug.log')
      for (const log of logs) {
        const at = (re: RegExp) => log.findIndex((line) => re.test(line))
        const setup = at(/setup 1\/1 \$ echo ready > ready\.txt/)
        const toSetup = at(/egress → setup: allow-all/)
        const toAgent = at(/egress → agent: proxy/)
        const harness = at(/starting fake: bootstrap and session/)
        assert.ok(
          toSetup >= 0 && toSetup < setup && setup < toAgent && toAgent < harness,
          `setup's policy, its steps, the agent's policy, then the harness:\n${log.join('\n')}`,
        )
      }
    },
  },
  {
    dir: 'egress/secret-hosts-allowed',
    tiers: ['docker'],
    env: 'keyed',
    canaryEnv: 'closed',
    hostEnv: () => ({ ...egressEnv(), REEVAL_FIXTURE_TOKEN: TOKEN }),
    canary: zeroBy('reaches-the-listener'),
    canaryGraded: { 'reaches-the-listener': /^\["blocked by the reeval egress policy: / },
    record: ({ run, runDir }) => {
      const egress = landed(run)?.egress
      assert.equal(egress?.policy, 'deny-all')
      assert.deepEqual(
        egress?.allowed,
        [egressTarget.host],
        "the secret's host, allowed automatically",
      )
      assert.deepEqual(
        egress?.contacted.map((h) => h.host),
        [egressTarget.host],
      )
      assert.equal(filesContaining(runDir, TOKEN), '')
    },
  },
  {
    dir: 'egress/harness-under-deny-all',
    tiers: ['docker', 'real'],
    env: 'closed',
    canary: zeroBy('observed:reached.txt'),
    canarySaw: { 'reached.txt': /^403 000\n?$/ },
    record: ({ run, tier }) => {
      const egress = landed(run)?.egress
      assert.equal(egress?.policy, 'deny-all')
      assert.deepEqual(egress?.allowed, ['api2.cursor.sh', '*.cursor.sh'])
      assert.ok(
        egress?.contacted.some((h) => h.host === 'api2.cursor.sh'),
        JSON.stringify(egress),
      )
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]?.egress
      assert.deepEqual(
        canary?.blocked.map((h) => [h.host, h.reason]),
        [['registry.npmjs.org', "registry.npmjs.org isn't in the allowlist"]],
      )
      if (tier === 'real') {
        // Real Cursor talks to more than its API: whatever else it tried is refused and recorded.
        assert.ok(
          egress?.blocked.every((h) => !/cursor\.(sh|com)$/.test(h.host)),
          JSON.stringify(egress),
        )
      }
    },
  },
  {
    dir: 'sandbox/unprivileged',
    tiers: ['docker', 'podman'],
    env: 'plain',
    canaryEnv: 'rooted',
    canary: zeroBy('observed:ids'),
    canarySaw: { ids: '0 00000000000000cf / 0' },
  },
  {
    dir: 'sandbox/kvm-device',
    tiers: ['docker'],
    env: 'kvm',
    canaryEnv: 'plain',
    canary: zeroBy('observed:kvm'),
    canarySaw: { kvm: 'refused' },
    hostDevice: '/dev/kvm',
  },
  {
    // Docker and Podman only: every exec goes through engine/umask-0000, which starts it at
    // umask 0000 as Docker 29.6+ does under Docker-in-Docker and rootless; CI's engines don't.
    dir: 'sandbox/exec-umask',
    tiers: ['docker', 'podman'],
    env: 'placed',
    canaryEnv: 'unmasked',
    canary: zeroBy('observed:writable'),
    canarySaw: { writable: ['777 out', '666 out/log'] },
    prepare: (dir) => {
      mkdirSync(join(dir, 'bin'))
      for (const engine of ['docker', 'podman']) {
        cpSync(join(dir, 'engine/umask-0000'), join(dir, 'bin', engine))
        chmodSync(join(dir, 'bin', engine), 0o755)
      }
    },
    hostEnv: (dir) => ({ PATH: `${join(dir, 'bin')}${delimiter}${process.env.PATH}` }),
  },
  {
    dir: 'sandbox/podman-bridge',
    tiers: ['podman'],
    env: 'bridged',
    canary: zeroBy('observed:addresses'),
    canarySaw: {
      addresses: (a) =>
        Array.isArray(a) && a.length > 0 && !a.some((x) => String(x).startsWith('10.0.2.')),
    },
  },
  {
    dir: 'sandbox/no-unshare',
    tiers: ['docker', 'podman'],
    env: 'plain',
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^unshare: unshare failed: Operation not permitted/ },
  },
  {
    dir: 'sandbox/read-before-send',
    tiers: ['fake', 'docker'],
    env: 'notes',
    canary: zeroBy('observed:notes.txt'),
    canarySaw: { 'notes.txt': 'from the environment\n' },
    record: ({ run }) => {
      const [attempt] = run.evals.find((e) => e.name === 'lands')?.attempts ?? []
      assert.deepEqual(attempt?.turns, [], 'no turn was sent')
      assert.ok((attempt?.timings.setupMs ?? 0) > 0, 'the start is timed as setup')
    },
  },
  {
    dir: 'sandbox/concurrent-first-use',
    tiers: ['fake', 'docker'],
    env: 'notes',
    canary: zeroBy('observed:marker.txt'),
    canarySaw: { 'marker.txt': 'written' },
    record: ({ run }) => {
      const [attempt] = run.evals.find((e) => e.name === 'lands')?.attempts ?? []
      assert.deepEqual(
        attempt?.checks.map((x) => [x.command, x.exitCode]),
        [['test -f notes.txt', 0]],
      )
    },
  },
  {
    dir: 'sandbox/write-file',
    tiers: ['fake', 'docker', 'podman'],
    env: 'greeting',
    canary: zeroBy('observed:diff'),
  },
  {
    dir: 'sandbox/write-file-edit',
    tiers: ['fake', 'docker'],
    env: 'greeting',
    canary: zeroBy('observed:statuses'),
    canarySaw: { statuses: ['modified', 'modified'] },
  },
  {
    dir: 'sandbox/snapshot-no-history',
    tiers: ['fake', 'docker'],
    env: 'seeded',
    canary: zeroBy('observed:probe'),
    canarySaw: { probe: 'pre-seed content in: nowhere' },
  },
  {
    dir: 'sandbox/snapshot-unreadable',
    tiers: ['docker', 'podman'],
    env: 'plain',
    canaryEnv: 'rooted',
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': 'read' },
  },
  {
    dir: 'sandbox/diff-private-file',
    tiers: ['fake', 'docker'],
    env: 'plain',
    posixModes: true,
    canary: zeroBy('observed:diff'),
    canarySaw: { diff: ['added .token', 'added private/key'] },
  },
  {
    dir: 'sandbox/login-shell-path',
    tiers: ['docker'],
    env: 'plain',
    canaryEnv: 'stock',
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': '' },
    prepare: (dir) =>
      execFileSync(
        'docker',
        ['build', '--quiet', '--tag', 'reeval-fixture-login-path:latest', join(dir, 'image')],
        { stdio: 'ignore' },
      ),
  },
  {
    dir: 'sandbox/login-shell-path-dockerfile',
    tiers: ['docker'],
    env: 'plain',
    canaryEnv: 'stock',
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': '' },
  },
  {
    dir: 'sandbox/limits',
    tiers: ['docker', 'podman'],
    env: 'plain',
    canaryEnv: 'unlimited',
    canary: zeroBy('observed:limits'),
    canarySaw: { limits: /^4294967296\n\d+ 100000\n1024\n$/ },
  },
  {
    dir: 'sandbox/swap',
    tiers: ['docker'],
    env: 'plain',
    canaryEnv: 'doubled',
    canary: zeroBy('observed:swap'),
    canarySaw: { swap: '536870912\n' },
  },
  {
    dir: 'sandbox/oom-is-infra',
    tiers: ['docker', 'podman'],
    env: 'small',
    lands: {
      outcome: 'infra_error',
      error: {
        kind: 'infra',
        message:
          /^out of memory: \d+ process(es)? killed at the 128m limit \(\+128m swap\); raise (docker|podman)\(\{ memory \}\)$/,
      },
    },
    canary: zeroBy('succeeded:kill'),
    record: ({ run }) => {
      const [lands, canary] = ['lands', 'canary'].map(
        (name) => run.evals.find((e) => e.name === name)?.attempts[0]?.error,
      )
      assert.equal(lands?.resource?.cause, 'oom')
      assert.ok((lands?.resource?.kills ?? 0) > 0, JSON.stringify(lands))
      assert.equal(canary?.resource, undefined)
    },
  },
  {
    dir: 'sandbox/resources',
    tiers: ['docker', 'podman'],
    env: 'busy',
    canary: zeroBy('observed:cpu-seconds'),
    canarySaw: { 'cpu-seconds': /^[01]$/ },
    record: ({ run, tier }) => {
      const [lands, canary] = ['lands', 'canary'].map(
        (name) => run.evals.find((e) => e.name === name)?.attempts[0]?.resources,
      )
      for (const r of [lands, canary]) {
        assert.equal(r?.scope, 'container', JSON.stringify(r))
        assert.deepEqual(r?.machine, {
          sandbox: tier === 'podman' ? 'podman' : 'docker',
          vcpus: 1,
          memoryBytes: 512 * 1024 ** 2,
        })
      }
      const [used, idle] = [lands?.usage, canary?.usage]
      assert.ok((used?.cpuSeconds ?? 0) >= 1.5, JSON.stringify(used))
      assert.ok((used?.peakCores ?? 0) >= (used?.avgCores ?? 1), JSON.stringify(used))
      assert.ok((used?.peakCores ?? 9) <= 1.05, JSON.stringify(used))
      assert.ok((used?.peakMemoryBytes ?? 0) >= 256 * 1024 ** 2, JSON.stringify(used))
      assert.ok((used?.p95Cores ?? 9) <= (used?.peakCores ?? 0), JSON.stringify(used))
      assert.ok((used?.cgroupPeakMemoryBytes ?? 0) >= 256 * 1024 ** 2, JSON.stringify(used))
      // Two busy threads on one CPU's quota.
      assert.ok((used?.throttling?.throttledPeriods ?? 0) > 0, JSON.stringify(used))
      assert.ok(
        (used?.throttling?.throttledSeconds ?? 0) > (idle?.throttling?.throttledSeconds ?? 9),
        JSON.stringify([used, idle]),
      )
      assert.equal(used?.partial, undefined)
      assert.equal(used?.diskReadBytes, undefined)
      assert.ok((idle?.cpuSeconds ?? 9) < 1, JSON.stringify(idle))
      assert.ok((idle?.peakMemoryBytes ?? 0) < 128 * 1024 ** 2, JSON.stringify(idle))
    },
  },
  {
    dir: 'sandbox/resources-hidden',
    tiers: ['docker', 'podman'],
    env: 'watched',
    canary: zeroBy('observed:sampler'),
    canarySaw: { sampler: 'none' },
    record: ({ run }) => {
      // The sampler ran while the check looked for it.
      const r = run.evals.find((e) => e.name === 'lands')?.attempts[0]?.resources
      assert.ok((r?.usage?.durationMs ?? 0) >= 3000, JSON.stringify(r))
      assert.equal(r?.usage?.partial, undefined, JSON.stringify(r))
    },
  },
  {
    dir: 'env/files-home',
    tiers: ['fake', 'docker'],
    env: 'home-files',
    canary: zeroBy('has-file:.config/reeval/hint.txt'),
  },
  {
    dir: 'env/sandbox-image',
    tiers: ['fake', 'docker'],
    env: 'python',
    sandbox: 'python',
    canary: zeroBy('observed:sandbox'),
    canarySaw: { sandbox: 'python' },
  },
  {
    dir: 'env/sandbox-extend-replace',
    tiers: ['fake', 'docker'],
    env: 'child',
    sandbox: 'child',
    canary: zeroBy('observed:sandbox'),
    canarySaw: { sandbox: 'child' },
  },
  {
    dir: 'env/sandbox-inherit',
    tiers: ['fake', 'docker'],
    env: 'plain',
    sandbox: 'from-root',
    cells: ['plain', 'skilled'],
    canary: zeroBy('observed:sandbox'),
    canarySaw: { sandbox: 'from-root' },
  },
  {
    dir: 'compare/independent',
    tiers: ['fake', 'docker'],
    env: 'variant',
    cells: ['baseline', 'variant'],
    canaryPass: ['baseline'],
    canary: zeroBy('has-file:from-baseline.txt'),
    record: ({ run }) => {
      assert.deepEqual(run.environments.map((e) => e.name).sort(), ['baseline', 'variant'])
      const variant = run.environments.find((e) => e.name === 'variant')
      assert.equal(variant?.parent, null)
      assert.deepEqual(
        variant?.files.map((f) => f.path),
        ['from-variant.txt'],
      )
      assert.ok(
        run.evals.every((e) => e.compare?.baseline === 'baseline'),
        JSON.stringify(run.evals.map((e) => e.compare)),
      )
    },
  },
  {
    dir: 'history/artifacts-failures',
    tiers: ['fake'],
    env: 'marked',
    cells: ['plain', 'marked'],
    lands: {
      outcome: 'pass',
      error: {
        kind: 'assertion',
        message: zeroBy('has-file:marker.txt'),
      },
    },
    landsPass: ['marked'],
    canaryCells: ['marked', 'plain'],
    canary: zeroBy('has-file:marker.txt'),
    canaryPass: ['marked'],
    record: ({ project }) => {
      const history = readRun(project, { history: 'evals/.history' })
      assert.equal(history.run.artifacts, 'failures')
      const kept = history.run.evals.flatMap((e) =>
        e.attempts.map((a) => {
          const refs = [
            ...Object.values(a.files).flatMap((v) => (Array.isArray(v) ? v : v ? [v] : [])),
            ...a.checks.flatMap((c) => (c.log ? [c.log] : [])),
          ]
          for (const ref of refs) assert.ok(existsSync(join(history.dir, ref.path)), ref.path)
          return [e.name, e.cells.find((c) => c.key === a.cell)?.role, a.outcome, refs.length > 0]
        }),
      )
      assert.deepEqual(
        kept,
        [
          ['canary', 'control', 'pass', false],
          ['canary', 'variant', 'fail', true],
          ['lands', 'control', 'fail', true],
          ['lands', 'variant', 'pass', false],
        ],
        'each failed attempt keeps its files, whatever its eval did',
      )
    },
  },
  {
    dir: 'history/archive',
    tiers: ['fake'],
    env: 'archived',
    canary: zeroBy('has-file:missing.txt'),
    record: async ({ project }) => {
      const history = readRun(project, { history: 'evals/.history' })
      const { runId } = history.run
      const folder = dirname(history.dir)
      const loose = [
        `${runId}.json`,
        ...readdirSync(history.dir, { recursive: true, withFileTypes: true })
          .filter((e) => e.isFile())
          .map((e) => `${runId}/${relative(history.dir, join(e.parentPath, e.name))}`),
      ].sort()
      assert.ok(
        loose.some((p) => p.endsWith('/trajectory.jsonl')),
        "the canary's failed attempt kept its files",
      )
      const archive = await openArchive(join(folder, `${runId}.zip`))
      try {
        await archive.verify()
        assert.deepEqual(
          archive.manifest.files.map((f) => f.path),
          loose,
          'the zip holds the record and every file recorded beside it',
        )
        for (const path of loose) {
          assert.deepEqual(await archive.read(path), readFileSync(join(folder, path)), path)
        }
      } finally {
        await archive.close()
      }
    },
  },
  {
    dir: 'history/debug-archive',
    tiers: ['fake'],
    env: 'archived',
    canary: zeroBy('has-file:missing.txt'),
    record: async ({ project }) => {
      const { runId } = readRun(project, { history: 'evals/.history' }).run
      const debug = join(project, '.reeval', 'debug')
      const loose = readdirSync(join(debug, runId), { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => `${runId}/${relative(join(debug, runId), join(e.parentPath, e.name))}`)
        .sort()
      assert.ok(loose.length > 0, 'the run left debug data')
      const archive = await openArchive(join(debug, `${runId}.zip`))
      try {
        await archive.verify()
        assert.equal(archive.manifest.debugLevel, 'all')
        assert.deepEqual(
          archive.manifest.files.map((f) => f.path),
          loose,
          "the zip holds the whole of the run's debug data",
        )
      } finally {
        await archive.close()
      }
      assert.equal(existsSync(join(project, 'evals/.history', `${runId}.zip`)), false)
    },
  },
  {
    dir: 'compare/question-explicit',
    tiers: ['fake'],
    env: 'variant',
    cells: ['baseline', 'variant'],
    canary: zeroBy('observed:out.txt'),
    canarySaw: { 'out.txt': 'hi\n' },
    record: ({ run }) => {
      const answer = answerOf(run, 'lands')
      assert.deepEqual(answer.stateOptions, {
        task: false,
        output: false,
        files: false,
        diff: true,
        trajectory: false,
        turns: 'all',
        checks: false,
      })
      assert.equal(answer.artifacts, undefined)
      assert.deepEqual(shownOf(answer), [{ keys: ['diff'], task: false, reply: false }])
    },
  },
  {
    dir: 'compare/question-state',
    tiers: ['fake'],
    env: 'variant',
    cells: ['baseline', 'variant'],
    canary: zeroBy('prints-bye'),
    canaryGraded: { 'prints-bye': 'hi\n' },
    record: ({ run }) => {
      const answer = answerOf(run, 'lands')
      assert.equal(answer.stateOptions?.turns, 'last')
      assert.deepEqual(shownOf(answer), [
        {
          keys: ['checks', 'output'],
          output: 'REPLY-MARK',
          checks: [{ command: 'cat out.txt', exitCode: 0, stdout: 'hi\n', stderr: '' }],
          first: false,
        },
      ])
    },
  },
  {
    dir: 'compare/question-artifacts',
    tiers: ['fake', 'docker'],
    env: 'variant',
    cells: ['baseline', 'variant'],
    canary: /^score 0\.00 below 1: page-status:aside errored: .*aside/,
    record: ({ run }) => {
      const answer = answerOf(run, 'lands')
      assert.deepEqual(answer.artifacts, ['landing'])
      assert.deepEqual(shownOf(answer), [
        { artifacts: [['Attempt A, screenshot 1 of 1', true]], named: false },
      ])
      for (const vote of answer.votes) {
        assert.deepEqual(vote.artifacts, { a: ['landing'], b: ['landing'] })
      }
    },
  },
  {
    dir: 'compare/question-attempt',
    tiers: ['fake', 'docker'],
    env: 'asked',
    canary: zeroBy('observed:out.txt'),
    canarySaw: { 'out.txt': 'hi\n' },
    record: ({ run, runDir }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      const answer = attempt?.answers?.[0]
      assert.ok(answer, 'lands has an attempt answer')
      assert.equal(answer.error, undefined, answer.error)
      assert.deepEqual(answer.stateOptions, {
        task: true,
        output: true,
        files: false,
        diff: true,
        trajectory: true,
        turns: 'all',
        checks: false,
      })
      assert.deepEqual(answer.choices, ['yes', 'no'])
      assert.equal(answer.choice, 'yes')
      assert.deepEqual(JSON.parse(answer.text), {
        keys: ['diff', 'turns'],
        choices: ['yes', 'no'],
        task: true,
        reply: true,
      })
      assert.match(answer.input?.path ?? '', /\/1\/questions\/1\.json$/)
      const input = JSON.parse(readFileSync(join(runDir, answer.input?.path ?? ''), 'utf8'))
      assert.equal(input.question, 'Did it write out.txt?')
      assert.match(input.prompt, /write out\.txt/)
      const failed = run.evals.find((e) => e.name === 'canary')?.attempts[0]
      assert.equal(failed?.outcome, 'fail')
      assert.equal(failed?.answers?.[0]?.choice, 'yes', 'a failed attempt is asked too')
    },
  },
  {
    dir: 'compare/question-input',
    tiers: ['fake', 'docker'],
    env: 'variant',
    cells: ['baseline', 'variant'],
    hostEnv: { REEVAL_FIXTURE_TOKEN: TOKEN },
    canary: /^score 0\.00 below 1: page-status:aside errored: .*aside/,
    record: ({ run, runDir }) => {
      const entry = run.evals.find((e) => e.name === 'lands')
      const answer = answerOf(run, 'lands')
      assert.equal(answer.input?.path, `${entry?.slug}/questions/1.json`)
      const input = JSON.parse(readFileSync(join(runDir, answer.input.path), 'utf8'))
      assert.equal(input.question, 'Which page looks better?')
      assert.deepEqual(input.artifacts, ['landing'])
      assert.deepEqual(
        input.calls.map((c: { swapped: boolean; labels: object }) => [c.swapped, c.labels]),
        [
          [false, { A: 'baseline', B: 'variant' }],
          [true, { A: 'variant', B: 'baseline' }],
        ],
      )
      const landing = (arm: string) =>
        entry?.attempts
          .find((a) => a.cell.includes(`/${arm}/`))
          ?.files.artifacts?.find((a) => a.name === 'landing')?.path
      for (const call of input.calls) {
        assert.match(call.prompt, /^Question: Which page looks better\?/)
        assert.match(call.prompt, /write the page for \[REDACTED\]/)
        assert.deepEqual(
          call.screenshots,
          [call.labels.A, call.labels.B].map((side: string, i: number) => ({
            label: `Attempt ${'AB'[i]}, screenshot 1 of 1`,
            side,
            name: 'landing',
            path: landing(side),
          })),
        )
        for (const shot of call.screenshots) assert.ok(existsSync(join(runDir, shot.path)))
      }
      assert.equal(filesContaining(runDir, TOKEN), '')
    },
  },
  {
    dir: 'compare/control-empty',
    tiers: ['fake', 'docker'],
    env: 'variant',
    cells: ['empty', 'variant'],
    canaryCells: ['empty'],
    canary: zeroBy('has-file:from-variant.txt'),
    record: ({ run }) => {
      const empty = run.environments.find((e) => e.name === 'empty')
      assert.deepEqual(empty?.files, [])
      for (const e of run.evals.filter((e) => e.name === 'lands')) {
        assert.deepEqual(e.compare, { baseline: 'empty' })
        assert.equal(e.cells.find((c) => c.role === 'control')?.environment, 'empty')
        assert.ok(e.cells.find((c) => c.role === 'variant')?.lift, JSON.stringify(e.cells))
      }
    },
  },
  {
    dir: 'env/files-binary',
    tiers: ['fake', 'docker'],
    env: 'binary-file',
    canary: zeroBy('utf8-bytes'),
    // Every byte value, gzipped: invalid as UTF-8, and a real archive.
    canaryGraded: { 'utf8-bytes': /^[0-9a-f]{64}\b/ },
    prepare: (dir) =>
      writeFileSync(
        join(dir, 'blob.tgz'),
        gzipSync(Buffer.from(Array.from({ length: 1024 }, (_, i) => (i * 7) % 256))),
      ),
    record: ({ run, project }) => {
      const sha = createHash('sha256')
        .update(readFileSync(join(project, 'blob.tgz')))
        .digest('hex')
      const env = run.environments.find((e) => e.name === 'binary-file')
      assert.deepEqual(env?.files, [{ path: 'blob.tgz', sha256: sha }])
    },
  },
  {
    dir: 'env/files-odd-names',
    tiers: ['fake', 'docker'],
    env: 'odd-names',
    canary: zeroBy('split-name'),
    canaryGraded: {
      'split-name': ['dir/in.txt', 'odd\n./plain.txt', 'plain.txt', 'two\nlines.txt'],
    },
  },
  {
    dir: 'env/files-directory',
    tiers: ['fake', 'docker'],
    env: 'fixture-dir',
    canary: zeroBy('lands-ignored'),
    canaryGraded: {
      'lands-ignored': './README.md\n./lib/build/tool.js\n./package.json\n./src/index.js\n',
    },
    prepare: (dir) => {
      for (const path of ['node_modules/dep/index.js', 'dist/app.js']) {
        mkdirSync(dirname(join(dir, 'fixture', path)), { recursive: true })
        writeFileSync(join(dir, 'fixture', path), 'ignored by default')
      }
    },
    record: ({ run }) => {
      const env = run.environments.find((e) => e.name === 'fixture-dir')
      assert.deepEqual(
        env?.files.map((f) => f.path),
        ['README.md', 'lib/build/tool.js', 'package.json', 'src/index.js'],
      )
      const readme = env?.files.find((f) => f.path === 'README.md')
      assert.equal(readme?.sha256, createHash('sha256').update('overridden').digest('hex'))
    },
  },
  {
    dir: 'env/files-directory-executable',
    tiers: ['fake', 'docker'],
    env: 'executables',
    posixModes: true,
    canary: zeroBy('all-executable'),
    canaryGraded: { 'all-executable': 'bin/run.sh x\nnotes.txt -\n' },
    prepare: (dir) => {
      chmodSync(join(dir, 'fixture/bin/run.sh'), 0o755)
      chmodSync(join(dir, 'fixture/notes.txt'), 0o644)
    },
  },
  {
    dir: 'env/rules',
    tiers: ['fake', 'docker'],
    env: 'house-rules',
    canary: zeroBy('has-file:CLAUDE.md'),
  },
  ...perHarness(BAKED_HARNESSES, (layout) => ({
    dir: 'harness/rules',
    tiers: ['fake', 'docker'],
    env: 'house-rules',
    canary: /^score 0\.00 below 1: has-file:(AGENTS|CLAUDE)\.md scored 0\.00$/,
    record: ({ run }) =>
      assert.deepEqual(envFiles(run), [layout === 'claude-code' ? 'CLAUDE.md' : 'AGENTS.md']),
  })),
  ...perHarness(BAKED_HARNESSES, () => ({
    dir: 'harness/workspace-skills',
    tiers: ['fake', 'docker'],
    env: 'greeting',
    canary: zeroBy('skill-files'),
    canaryGraded: { 'skill-files': [''] },
  })),
  ...perHarness(BUT_CURSOR, (layout) => ({
    dir: 'harness/home-skills',
    tiers: ['fake', 'docker'],
    env: 'greeting',
    canary: zeroBy('reads-the-skill-1'),
    canaryGraded: { 'reads-the-skill-1': '' },
    record: ({ run, tier }) => {
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.placement]),
        [['house-greeting', 'harness']],
      )
      if (tier === 'fake' || layout !== 'claude-code') return
      const seen = landed(run)?.context ?? []
      assert.ok(
        seen.some((c) => c.path === '~/.claude/skills/house-greeting/SKILL.md'),
        JSON.stringify(seen),
      )
    },
  })),
  ...perHarness(BUT_CURSOR, (layout) => ({
    dir: 'harness/dockerfile',
    tiers: ['docker'],
    env: 'plain',
    canary: zeroBy('cursor-sdk'),
    canaryGraded: { 'cursor-sdk': '' },
    record: ({ run }) => {
      const [image] = run.stack.images
      // Not baked again: the Dockerfile's base carries the harness's label.
      assert.match(image?.base ?? '', /^reeval-dockerfile:docker-[0-9a-f]{16}$/)
      assert.match(image?.agentCli ?? '', AGENT_CLI[layout] ?? /^$/)
    },
  })),
  ...perHarness(['codex', 'grok-build'], (layout) => ({
    dir: 'harness/plugin-kept-whole',
    tiers: ['fake', 'docker'],
    env: 'house',
    canary: zeroBy('mcp-in-config'),
    canaryGraded: { 'mcp-in-config': /^Loaded plugins: house \(skills, mcp\)/ },
    record: ({ run, tier }) => {
      if (tier === 'fake') return
      const seen = (landed(run)?.context ?? []).map((c) => c.path)
      assert.ok(
        seen.includes('~/.reeval/plugins/house/skills/house-style/SKILL.md'),
        JSON.stringify(seen),
      )
      const own = OWN_SKILLS[layout] ?? ''
      assert.ok(!seen.some((p) => p.includes(own)), JSON.stringify(seen))
    },
  })),
  {
    dir: 'harness/cursor-rules-reach-agent',
    tiers: ['real'],
    env: 'house-rules',
    canaryEnv: 'no-rules',
    canary: zeroBy('says-the-word'),
    canaryGraded: {
      'says-the-word': (text) => typeof text === 'string' && !text.includes('MARMALADE'),
    },
  },
  {
    dir: 'harness/cursor-reports-usage',
    tiers: ['real'],
    env: 'plain',
    canary: zeroBy('no-usage'),
    canaryGraded: { 'no-usage': { input: (n) => typeof n === 'number' && n > 0 } },
    record: ({ run }) => {
      const attempt = landed(run)
      const turns = attempt?.turns ?? []
      assert.equal(turns.length, 2)
      for (const t of turns) {
        assert.ok(t.usage && t.usage.input + t.usage.cacheRead > 1000, 'the system prompt counts')
        // The model the SDK resolved, with the parameters it filled in.
        assert.match(t.model ?? '', new RegExp(`^${realModel.replace(/\./g, '\\.')}\\[.*=`))
      }
      assert.equal(
        attempt?.usage?.output,
        turns.reduce((n, t) => n + (t.usage?.output ?? 0), 0),
        "the attempt's total is its turns'",
      )
      assert.equal(run.cost.source, 'reported')
      assert.ok((run.cost.inputTokens ?? 0) > 0 && (run.cost.outputTokens ?? 0) > 0)
    },
  },
  {
    dir: 'harness/cursor-web-fetch',
    tiers: ['real'],
    env: 'plain',
    canary: zeroBy('no-beacon'),
    canaryGraded: { 'no-beacon': /\b\d+\s+[0-9a-f]{64}\b/ },
    record: ({ run }) => {
      const attempt = landed(run)
      assert.deepEqual(attempt?.turns[0]?.unreported, [])
      assert.ok((attempt?.activity.webFetches ?? 0) >= 1, 'the fetch is in the record')
    },
  },
  {
    dir: 'harness/opencode-web-search',
    tiers: ['real'],
    realHarness: 'opencode',
    env: 'closed',
    canary: zeroBy('no-search'),
    canaryGraded: { 'no-search': (n) => typeof n === 'number' && n >= 1 },
    record: ({ run }) => {
      const attempt = landed(run)
      assert.ok((attempt?.activity.webSearches ?? 0) >= 1, 'the search is in the record')
      assert.ok(
        attempt?.egress?.contacted.some((h) => h.host === 'mcp.exa.ai'),
        JSON.stringify(attempt?.egress),
      )
      assert.deepEqual(attempt?.egress?.blocked, [], 'nothing it needed was refused')
    },
  },
  {
    dir: 'harness/codex-web-search',
    tiers: ['real'],
    realHarness: 'codex',
    env: 'closed',
    canary: zeroBy('no-search'),
    canaryGraded: { 'no-search': (n) => typeof n === 'number' && n >= 1 },
    record: ({ run, project }) => {
      const attempt = landed(run)
      assert.ok((attempt?.activity.webSearches ?? 0) >= 1, 'the search is in the record')
      assert.deepEqual(attempt?.egress?.blocked, [], 'nothing it needed was refused')
      // An endpoint refusal is a 403 on an allowed host, so it's in the debug requests only.
      const root = join(project, '.reeval', 'debug', run.runId)
      const requests = readdirSync(root, { recursive: true, encoding: 'utf8' })
        .filter((f) => f.startsWith('lands-') && f.endsWith('requests.ndjson'))
        .flatMap((f) => readFileSync(join(root, f), 'utf8').trim().split('\n'))
        .map((l) => JSON.parse(l) as { method: string; url: string; status?: number })
      const searches = requests.filter((r) => r.url === 'https://api.openai.com/v1/alpha/search')
      assert.ok(searches.length >= 1, JSON.stringify(requests))
      assert.deepEqual(
        searches.map((r) => [r.method, r.status]),
        searches.map(() => ['POST', 200]),
        'each search got the key and an answer',
      )
    },
  },
  {
    dir: 'harness/antigravity-web-search',
    tiers: ['real'],
    realHarness: 'antigravity',
    env: 'closed',
    canary: zeroBy('no-search'),
    canaryGraded: { 'no-search': (n) => typeof n === 'number' && n >= 1 },
    record: ({ run, project }) => {
      const attempt = landed(run)
      assert.ok((attempt?.activity.webSearches ?? 0) >= 1, 'the search is in the record')
      assert.deepEqual(attempt?.egress?.blocked, [], 'nothing it needed was refused')
      // An endpoint refusal is a 403 on an allowed host, so it's in the debug requests only.
      const root = join(project, '.reeval', 'debug', run.runId)
      const requests = readdirSync(root, { recursive: true, encoding: 'utf8' })
        .filter((f) => f.startsWith('lands-') && f.endsWith('requests.ndjson'))
        .flatMap((f) => readFileSync(join(root, f), 'utf8').trim().split('\n'))
        .map((l) => JSON.parse(l) as { method: string; url: string; status?: number })
      const searches = requests.filter((r) => r.url.endsWith(':generateContent'))
      assert.ok(searches.length >= 1, JSON.stringify(requests))
      assert.deepEqual(
        searches.map((r) => [r.method, r.status]),
        searches.map(() => ['POST', 200]),
        'each search got the key and an answer',
      )
    },
  },
  {
    dir: 'harness/opencode-provider-key',
    tiers: ['real'],
    realHarness: 'opencode-anthropic',
    env: 'closed',
    canary: zeroBy('two-keys'),
    canaryGraded: { 'two-keys': (keys) => Array.isArray(keys) && keys.length === 1 },
    record: ({ run }) => {
      const attempt = landed(run)
      assert.ok(
        attempt?.servedModels?.some((m) => /^claude-sonnet-5-5/.test(m)),
        JSON.stringify(attempt?.servedModels),
      )
      assert.ok(
        attempt?.egress?.contacted.some((h) => h.host === 'api.anthropic.com'),
        JSON.stringify(attempt?.egress),
      )
      // The agent sometimes also hits registry.npmjs.org; that is curiosity, not a
      // missing brokered host.
      assert.deepEqual(
        (attempt?.egress?.blocked ?? []).filter((h) => h.host === 'api.anthropic.com'),
        [],
        'the provider host was not refused',
      )
    },
  },
  ...(
    [
      ['harness/pi-provider-key', 'pi-anthropic', /^claude-haiku-4-5/, 'api.anthropic.com'],
      ['harness/goose-provider-key', 'goose-openai', /^gpt-5\.4-mini/, 'api.openai.com'],
    ] as const
  ).map(
    ([dir, realHarness, served, host]): Feature => ({
      dir,
      tiers: ['real'],
      realHarness,
      env: 'closed',
      canary: zeroBy('two-keys'),
      canaryGraded: { 'two-keys': (keys) => Array.isArray(keys) && keys.length === 1 },
      record: ({ run }) => {
        const attempt = landed(run)
        assert.ok(
          attempt?.servedModels?.some((m) => served.test(m)),
          JSON.stringify(attempt?.servedModels),
        )
        assert.ok(
          attempt?.egress?.contacted.some((h) => h.host === host),
          JSON.stringify(attempt?.egress),
        )
        assert.deepEqual(
          (attempt?.egress?.blocked ?? []).filter((h) => h.host === host),
          [],
          'the provider host was not refused',
        )
      },
    }),
  ),
  {
    dir: 'harness/goose-eval-env',
    tiers: ['real'],
    realHarness: 'goose',
    env: 'closed',
    canary: zeroBy('no-project'),
    canaryGraded: {
      'no-project': (vars) => Array.isArray(vars) && vars.includes('GCP_PROJECT_ID=eval-project'),
    },
    record: ({ run }) => {
      const attempt = landed(run)
      assert.ok((attempt?.activity.tools ?? 0) >= 1, JSON.stringify(attempt?.activity))
    },
  },
  {
    dir: 'harness/fx-mcp-env',
    tiers: ['real'],
    realHarness: 'fx',
    env: 'probed',
    canaryEnv: 'own',
    hostEnv: () => ({ REEVAL_FIXTURE_TOKEN: TOKEN, ...egressEnv() }),
    canary: zeroBy('eval-word'),
    canaryGraded: { 'eval-word': (lines) => Array.isArray(lines) && lines.includes('word=OWN-9') },
    record: ({ run }) => {
      const egress = landed(run)?.egress
      assert.ok(
        egress?.contacted.some((h) => h.host === egressTarget.host),
        JSON.stringify(egress),
      )
      assert.deepEqual(egress?.blocked, [], 'nothing it needed was refused')
    },
  },
  {
    dir: 'harness/goose-reports-usage',
    tiers: ['real'],
    realHarness: 'goose',
    env: 'plain',
    canary: zeroBy('no-usage'),
    canaryGraded: { 'no-usage': { input: (n) => typeof n === 'number' && n > 0 } },
    record: ({ run }) => {
      const attempt = landed(run)
      const turns = attempt?.turns ?? []
      assert.equal(turns.length, 2)
      assert.ok((attempt?.activity.tools ?? 0) >= 1, JSON.stringify(attempt?.activity))
      for (const t of turns) {
        assert.ok(t.usage && t.usage.input + t.usage.cacheRead > 1000, 'the system prompt counts')
        // The ledger counts thinking tokens in the output, not apart.
        assert.equal(t.usage.reasoning, null)
      }
      assert.equal(
        attempt?.usage?.output,
        turns.reduce((n, t) => n + (t.usage?.output ?? 0), 0),
        "the attempt's total is its turns'",
      )
    },
  },
  {
    dir: 'harness/claude-code-plugin',
    tiers: ['fake', 'docker'],
    image: 'claude-code',
    env: 'house',
    canary: zeroBy('mcp-in-config'),
    canaryGraded: { 'mcp-in-config': /^Loaded plugins: house \(skills, mcp\)/ },
    record: ({ run, tier }) => {
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.plugin]),
        [['house-style', 'house']],
      )
      if (tier === 'fake') return
      const seen = (landed(run)?.context ?? []).map((c) => c.path)
      for (const path of [
        '~/.claude/settings.json',
        '~/.reeval/plugins/.claude-plugin/marketplace.json',
        '~/.reeval/plugins/house/skills/house-style/SKILL.md',
      ]) {
        assert.ok(seen.includes(path), `${path} in ${JSON.stringify(seen)}`)
      }
    },
  },
  {
    dir: 'harness/antigravity-plugin',
    tiers: ['fake', 'docker'],
    image: 'antigravity',
    env: 'house',
    canary: zeroBy('mcp-in-config'),
    canaryGraded: { 'mcp-in-config': /^Loaded plugins: house \(skills, mcp, rules\)/ },
    record: ({ run, tier }) => {
      if (tier === 'fake') return
      const seen = (landed(run)?.context ?? []).map((c) => c.path)
      assert.ok(
        seen.includes('~/.reeval/plugins/house/skills/house-style/SKILL.md'),
        JSON.stringify(seen),
      )
      assert.ok(!seen.some((p) => p.includes('/.gemini/config/skills/')), JSON.stringify(seen))
      // What the fake agent's own agy plugin install wrote, which the attempt's context lists.
      assert.ok(
        seen.includes('~/.gemini/config/plugins/house/mcp_config.json'),
        JSON.stringify(seen),
      )
    },
  },
  {
    dir: 'harness/cursor-plugin',
    tiers: ['fake', 'docker', 'real'],
    env: 'house',
    canary: zeroBy('has-file:codeword.txt'),
    record: ({ run, tier }) => {
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.plugin]),
        [['house-style', 'house']],
      )
      // Unpacked before the snapshot: the diff has only what the agent wrote.
      assert.deepEqual(
        landed(run)?.changedFiles.map((f) => f.path),
        ['codeword.txt'],
      )
      if (tier === 'fake') return
      const seen = (landed(run)?.context ?? []).map((c) => c.path)
      for (const path of [
        '.cursor/rules/house-codeword.mdc',
        '.cursor/agents/reviewer.md',
        '.cursor/commands/ship.md',
        '.cursor/hooks.json',
      ]) {
        assert.ok(seen.includes(path), `${path} in ${JSON.stringify(seen)}`)
      }
      assert.ok(
        seen.some((p) => /^~\/(.+\/)?\.agents\/skills\/house-style\/SKILL\.md$/.test(p)),
        JSON.stringify(seen),
      )
    },
  },
  {
    dir: 'harness/opencode-plugin',
    tiers: ['fake', 'docker'],
    image: 'opencode',
    env: 'house',
    canary: zeroBy('has-file:review.txt'),
    record: ({ run, tier }) => {
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.plugin]),
        [['house-style', 'house']],
      )
      assert.deepEqual(
        landed(run)?.changedFiles.map((f) => f.path),
        ['review.txt'],
      )
      if (tier === 'fake') return
      const seen = (landed(run)?.context ?? []).map((c) => c.path)
      for (const path of [
        '~/.config/opencode/skills/house-style/SKILL.md',
        '.opencode/agents/reviewer.md',
        '.opencode/commands/ship.md',
      ]) {
        assert.ok(seen.includes(path), `${path} in ${JSON.stringify(seen)}`)
      }
    },
  },
  {
    dir: 'harness/pi-plugin',
    tiers: ['fake', 'docker'],
    image: 'pi',
    env: 'house',
    canary: zeroBy('has-file:release.txt'),
    record: ({ run, tier }) => {
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.plugin]),
        [['house-style', 'house']],
      )
      assert.deepEqual(
        landed(run)?.changedFiles.map((f) => f.path),
        ['release.txt'],
      )
      if (tier === 'fake') return
      const seen = (landed(run)?.context ?? []).map((c) => c.path)
      for (const path of ['~/.pi/agent/skills/house-style/SKILL.md', '.pi/prompts/ship.md']) {
        assert.ok(seen.includes(path), `${path} in ${JSON.stringify(seen)}`)
      }
    },
  },
  {
    dir: 'harness/fx-plugin',
    tiers: ['fake', 'docker'],
    image: 'fx',
    env: 'house',
    canary: zeroBy('has-file:style.txt'),
    record: ({ run, tier }) => {
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.plugin]),
        [['house-style', 'house']],
      )
      if (tier === 'fake') return
      const seen = (landed(run)?.context ?? []).map((c) => c.path)
      assert.ok(
        seen.includes(
          '~/.ai-sdk-harness/.harness-bootstrap/fx/home/.fx/skills/house-style/SKILL.md',
        ),
        JSON.stringify(seen),
      )
    },
  },
  {
    dir: 'harness/cursor-plugin-build',
    tiers: ['docker'],
    env: 'built',
    canary: zeroBy('observed:.cursor/agents/reviewer.md'),
    canarySaw: { '.cursor/agents/reviewer.md': /^---\nname: reviewer\ndescription: Rev/ },
  },
  {
    dir: 'harness/opencode-plugin-build',
    tiers: ['docker'],
    image: 'opencode',
    env: 'built',
    canary: zeroBy('observed:.opencode/agents/reviewer.md'),
    canarySaw: { '.opencode/agents/reviewer.md': /^---\ndescription: Reviews a change\. / },
  },
  {
    dir: 'harness/goose-plugin',
    tiers: ['fake', 'docker'],
    image: 'goose',
    env: 'house',
    canary: zeroBy('mcp-left-out'),
    canaryGraded: { 'mcp-left-out': /^Loaded skills: house-style; plugins: / },
    record: ({ run, tier }) => {
      assert.deepEqual(
        skills(run).map((s) => [s.name, s.plugin]),
        [['house-style', 'house']],
      )
      if (tier === 'fake') return
      const seen = (landed(run)?.context ?? []).map((c) => c.path)
      assert.ok(
        seen.includes(
          '~/.ai-sdk-harness/.harness-bootstrap/goose/home/.config/goose/skills/house-style/SKILL.md',
        ),
        JSON.stringify(seen),
      )
    },
  },
  {
    dir: 'harness/effort-requested-and-served',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: zeroBy('served-label'),
    canaryGraded: { 'served-label': 'fake-1[effort=medium]' },
    record: ({ run }) => {
      const attempt = landed(run)
      const cell = run.evals.find((e) => e.name === 'lands')?.cells[0]
      const harness = run.stack.harnesses[0]
      assert.equal(cell?.effort, 'high')
      assert.equal(attempt?.effort, 'high')
      assert.equal(attempt?.servedEffort, 'medium')
      assert.equal(harness?.effort, 'high')
      assert.deepEqual(harness?.resolvedEffort, ['medium'])
    },
  },
  {
    dir: 'harness/tool-output-cut',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: zeroBy('shell-output'),
    canaryGraded: { 'shell-output': { outputView: 'model', whole: true } },
    record: ({ run, runDir }) => {
      const trajectory = landed(run)?.files.trajectory?.path ?? ''
      const shell = readFileSync(join(runDir, trajectory), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
        .find((e) => e.type === 'tool' && e.tool === 'shell')
      assert.deepEqual(shell?.outputTruncated, { bytes: 318_911 })
      assert.match(shell.output, /^line-1\n[\s\S]*\n\[reeval: truncated \d+ of 318911 characters/)
      assert.match(shell.output, /END-OF-OUTPUT-77\n$/)
      assert.ok(!shell.output.includes('\nline-15000\n'), 'the middle is cut')
    },
  },
  {
    dir: 'harness/edit-payload',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: zeroBy('edit-payload'),
    canaryGraded: {
      'edit-payload': {
        path: 'big.txt',
        content: true,
        output: 'Wrote big.txt',
        outputView: 'model',
      },
    },
    record: ({ run, runDir }) => {
      const trajectory = landed(run)?.files.trajectory?.path ?? ''
      const edit = readFileSync(join(runDir, trajectory), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
        .find((e) => e.type === 'file-edit')
      assert.equal(edit?.output, 'Wrote big.txt')
      assert.match(
        edit.input,
        /^\{\n {2}"path": "big\.txt",\n[\s\S]*\n\[reeval: truncated \d+ of \d+ characters/,
      )
      assert.ok(edit.input.length < 128 * 1024, 'the middle is cut')
    },
  },
  {
    dir: 'harness/subagent-trajectory',
    tiers: ['fake'],
    env: 'plain',
    canary: zeroBy('own-tokens'),
    canaryGraded: { 'own-tokens': { input: 160, output: 16 } },
    record: ({ run, runDir }) => {
      const attempt = landed(run)
      const [turn] = attempt?.turns ?? []
      const own = { input: 100, output: 10, cacheRead: 0, cacheWrite: 0, reasoning: 0 }
      assert.deepEqual(turn?.agentUsage, own)
      assert.equal(turn?.subagentUsage, 'counted')
      assert.deepEqual(turn?.usage, { ...own, input: 160, output: 16 })
      const [streamed, unstreamed] = attempt?.subagents ?? []
      assert.equal(attempt?.subagents?.length, 2)
      const pick = (o: object | undefined, keys: string[]) =>
        Object.fromEntries(keys.map((k) => [k, (o as Record<string, unknown> | undefined)?.[k]]))
      const streamedWant = {
        n: 1,
        turn: 0,
        agent: 'general-purpose',
        prompt: 'write add.js',
        status: 'completed',
        events: 'streamed',
        toolCalls: 1,
        fileEdits: 1,
        usage: { ...own, input: 40, output: 4 },
        finalMessage: 'Wrote add.js.',
      }
      assert.deepEqual(pick(streamed, Object.keys(streamedWant)), streamedWant)
      const unstreamedWant = {
        n: 2,
        events: 'none',
        toolCalls: null,
        fileEdits: null,
        usage: { ...own, input: 20, output: 2 },
      }
      assert.deepEqual(pick(unstreamed, Object.keys(unstreamedWant)), unstreamedWant)
      const lines = readFileSync(join(runDir, attempt?.files.trajectory?.path ?? ''), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
      const tagged = lines.filter((e) => e.subagent === streamed?.id).map((e) => e.type)
      assert.deepEqual(tagged, ['file-edit', 'text'])
      assert.equal(attempt?.activity.fileEdits, 1)
    },
  },
  {
    dir: 'harness/turn-aborted-on-timeout',
    tiers: ['fake', 'docker', 'real'],
    env: 'plain',
    lands: {
      outcome: 'fail',
      error: { kind: 'timeout', message: /^The eval timed out$/ },
    },
    canary: zeroBy('aborted'),
    canaryGraded: { aborted: 'completed' },
    record: ({ run }) => assert.equal(landed(run)?.turns[0]?.status, 'aborted'),
    // Lands waits a 4s eval timeout; the canary waits the 10s fake delay, on top of
    // FAKE_TIMEOUT_MS's Windows load.
    timeoutMs: { fake: 180_000 },
  },
  {
    dir: 'harness/stuck-turn-kept',
    tiers: ['fake', 'docker'],
    env: 'plain',
    lands: {
      outcome: 'fail',
      error: { kind: 'timeout', message: /^The eval timed out$/ },
    },
    canary: zeroBy('aborted'),
    canaryGraded: { aborted: 'completed' },
    record({ run, runDir }) {
      const attempt = landed(run)
      const [turn] = attempt?.turns ?? []
      assert.equal(turn?.status, 'aborted')
      assert.deepEqual(turn?.usage, {
        input: 120,
        output: 30,
        cacheRead: 400,
        cacheWrite: 0,
        reasoning: 10,
      })
      const lines = readFileSync(join(runDir, attempt?.files.trajectory?.path ?? ''), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
      const shell = lines.find((e) => e.type === 'tool' && e.tool === 'shell')
      assert.equal(shell?.output, 'step-1\n')
      assert.ok(lines.some((e) => e.type === 'file-edit' && e.path.endsWith('notes.txt')))
      assert.ok(
        lines.some((e) => e.type === 'error' && /reeval stopped waiting/.test(e.message)),
        'the note says why the turn ends there',
      )
    },
    // Lands waits a 4s eval timeout and the 3s grace; the canary waits the 15s fake delay, on
    // top of FAKE_TIMEOUT_MS's Windows load.
    timeoutMs: { fake: 180_000 },
  },
  {
    dir: 'harness/rejected-key-is-infra',
    tiers: ['fake', 'docker'],
    env: 'plain',
    lands: {
      outcome: 'infra_error',
      error: {
        kind: 'infra',
        message:
          /^The API rejected FAKE_API_KEY: set a valid key in the environment or \.env\.local\. 401 Unauthorized/,
      },
    },
    canary: zeroBy('observed:status'),
    canarySaw: { status: 'error' },
    record: ({ run }) => {
      const turns = landed(run)?.turns ?? []
      assert.deepEqual(
        turns.map((t) => t.status),
        ['error', 'error'],
      )
      assert.match(turns[1]?.error ?? '', /^The API rejected FAKE_API_KEY/)
      assert.deepEqual(landed(run)?.checks, [], 'no check ran')
      assert.equal(landed(run)?.assertions, undefined, 'no check ran')
    },
  },
  {
    dir: 'harness/provider-stop-is-infra',
    tiers: ['fake', 'docker'],
    env: 'plain',
    lands: {
      outcome: 'infra_error',
      error: {
        kind: 'infra',
        message:
          /^The model provider stopped the turn, out of credit: Your credit balance is too low/,
      },
    },
    canary: zeroBy('observed:status'),
    canarySaw: { status: 'error' },
    record: ({ run }) => {
      const attempt = landed(run)
      assert.deepEqual(attempt?.error?.provider, { cause: 'credit', status: null })
      assert.deepEqual(
        attempt?.turns.map((t) => t.status),
        ['error', 'error'],
      )
      assert.deepEqual(attempt?.checks, [], 'no check ran')
    },
  },
  {
    dir: 'harness/unread-turn-error-is-infra',
    tiers: ['fake'],
    env: 'plain',
    lands: {
      outcome: 'infra_error',
      error: {
        kind: 'infra',
        message: /^Turn 0 ended with an error: 503 Service Unavailable: overloaded/,
      },
    },
    canary: zeroBy('observed:status'),
    canarySaw: { status: 'error' },
  },
  {
    dir: 'env/setup-order',
    tiers: ['fake', 'docker'],
    env: 'ordered',
    canary: zeroBy('observed:order.txt'),
    canarySaw: { 'order.txt': 'one\ntwo\n' },
  },
  {
    dir: 'env/setup-timeout',
    tiers: ['fake', 'docker'],
    env: 'slow',
    canaryEnv: 'quick',
    lands: {
      outcome: 'infra_error',
      error: {
        kind: 'infra',
        message:
          /^setup step 1\/1 "sleep 30 && touch slept" in environment slow timed out after 1s \(see setup\.log\)$/,
      },
    },
    canary: zeroBy('no-file-slept'),
  },
  {
    dir: 'env/setup-missing-cwd',
    tiers: ['fake', 'docker'],
    env: 'missing',
    canaryEnv: 'present',
    lands: {
      outcome: 'infra_error',
      error: {
        kind: 'infra',
        message:
          /^setup step 1\/1 "touch ran" in environment missing exited [1-9]\d* after \d+m?s \(see setup\.log\):\n.*nope\/dir/,
      },
    },
    canary: zeroBy('no-file-sub-ran'),
  },
  {
    dir: 'judge/build-output',
    tiers: ['fake'],
    env: 'built-app',
    canary: zeroBy('wrote-the-app'),
    record: ({ run }) =>
      assert.deepEqual(judgeGradeOf(run).judge?.dropped, [
        'dist/ (1 file): build output',
        'public/vendor.js: minified, a line of 1616 characters',
      ]),
  },
  {
    dir: 'judge/decide',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: zeroBy('noted'),
    record: ({ run, runDir }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.equal(attempt?.decisionUse?.calls, 1)
      assert.equal(attempt?.decisionUse?.usage?.input, 10)
      assert.equal(attempt?.usage?.input, undefined, "the decision's tokens aren't the agent's")
      assert.deepEqual(
        attempt?.grades?.map((g) => [g.grader, g.grade, g.score]),
        [
          ['decided', [{ type: 'boolean', probability: 0.9 }], 1],
          ['noted', 2, 1],
        ],
      )
      const path = attempt?.files.trajectory?.path
      assert.ok(path, 'lands wrote its trajectory')
      const lines = readFileSync(join(runDir, path), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
      assert.deepEqual(
        lines
          .map((l) => `${l.type} ${l.turn}`)
          .filter((l) => !l.startsWith('text') && !l.startsWith('file-edit')),
        ['prompt 0', 'turn-end 0', 'decision 1', 'prompt 1', 'turn-end 1'],
      )
      const { decision } = lines.find((l) => l.type === 'decision')
      assert.equal(decision.model, 'fake/fake-decision')
      assert.deepEqual(decision.answers, { done: { type: 'boolean', probability: 0.9 } })
      assert.deepEqual(Object.keys(decision.questions), ['done'])
      const state = JSON.stringify(decision.state)
      assert.match(state, /answer = 42/)
      assert.ok(!state.includes('ghp_'), "the agent's output is masked in the recorded state")
    },
  },
  {
    dir: 'judge/decide-outage',
    tiers: ['fake'],
    env: 'app',
    lands: {
      outcome: 'infra_error',
      error: {
        kind: 'infra',
        message:
          /^c\.decide\(\) with fake\/fake-decision failed: overloaded\. Set decide\.model in reeval\.config\.ts/,
      },
    },
    canary: zeroBy('observed:answered'),
    record: ({ run, runDir }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.deepEqual(attempt?.decisionUse, { calls: 1, usage: null })
      const path = attempt?.files.trajectory?.path
      assert.ok(path)
      const line = readFileSync(join(runDir, path), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
        .find((l) => l.type === 'decision')
      assert.equal(line?.decision.error, 'overloaded')
    },
  },
  {
    dir: 'judge/input-diff',
    tiers: ['fake'],
    env: 'scoped-app',
    canary: zeroBy('wrote-the-app'),
    record: ({ run }) =>
      assert.deepEqual(judgeGradeOf(run).judge?.dropped, [
        "notes.md: not in diff's patterns",
        "src/app.test.ts: not in diff's patterns",
      ]),
  },
  {
    dir: 'judge/input-contents-glob',
    tiers: ['fake'],
    env: 'glob-app',
    canary: zeroBy('tidy'),
  },
  {
    dir: 'judge/inputs-explicit',
    tiers: ['fake'],
    env: 'off-app',
    canary: zeroBy('summary-clear'),
  },
  {
    dir: 'judge/input-trajectory',
    tiers: ['fake'],
    env: 'trajectory-app',
    canary: zeroBy('ran-the-tests'),
  },
  {
    dir: 'judge/input-turns',
    tiers: ['fake'],
    env: 'turns-app',
    canary: zeroBy('kept-the-app'),
  },
  {
    dir: 'judge/input-checks',
    tiers: ['fake'],
    env: 'checks-app',
    canary: zeroBy('second-passed'),
  },
  {
    dir: 'judge/input-observations',
    tiers: ['fake'],
    env: 'observed-app',
    canary: zeroBy('picked-drizzle'),
    record: ({ run }) =>
      assert.deepEqual(
        judgeGradeOf(run).reads.observations?.map((o) => o.name),
        ['orm'],
      ),
  },
  {
    dir: 'history/observe',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: zeroBy('observed:deps'),
    canarySaw: {
      deps: (deps) =>
        Array.isArray(deps) && deps.includes('drizzle-orm') && !deps.includes('prisma'),
    },
    record: ({ run, stdout }) => {
      const observed = (name: string) =>
        run.evals.find((e) => e.name === name)?.attempts[0]?.observations
      const want = [
        { name: 'orm', value: 'drizzle', turn: 1 },
        { name: 'deps', value: ['drizzle-orm', 'pg'], turn: 1 },
        { name: 'dep-count', value: 2, turn: 1 },
      ].map((o) => ({ ...o, sha256: sha256(JSON.stringify(o.value)) }))
      assert.deepEqual(observed('lands'), want, 'the last value per name, in first-call order')
      assert.deepEqual(observed('canary'), want, 'a failed attempt keeps what it observed')
      assert.match(
        stdout,
        /Observed:\n[│ ]+orm +drizzle 1\n[│ ]+deps +drizzle-orm 1 · pg 1 · 1 attempt$/m,
      )
    },
  },
  {
    dir: 'history/observe-whole',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: zeroBy('observed:build-log'),
    record: async ({ run, runDir }) => {
      const [saw] = canaryAttempt(run)?.observations ?? []
      const sawLog = JSON.parse(readFileSync(join(runDir, saw?.file?.path ?? ''), 'utf8'))
      assert.equal(sawLog.split('\n').length, 4001, "the canary's whole 4000-line log")
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      const [log] = attempt?.observations ?? []
      const value = 'compiled\n'.repeat(4000)
      const json = JSON.stringify(value)
      assert.match(log?.file?.path ?? '', /^lands-\w+\/[^/]+\/1\/observations\/1\.json$/)
      assert.deepEqual(
        log,
        {
          name: 'build-log',
          value: null,
          turn: 1,
          sha256: sha256(json),
          file: { path: log?.file?.path, sha256: sha256(json), bytes: json.length },
        },
        'past 4 KiB, the value is in a file beside the record',
      )
      assert.equal(readFileSync(join(runDir, log?.file?.path ?? ''), 'utf8'), json)
      const t = attempt && (await readStoredAttempt(runDir, attempt))
      assert.equal(t?.observations[0]?.value, value)
    },
  },
  {
    dir: 'history/execs',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: zeroBy('reads-the-build-stderr'),
    canaryGraded: { 'reads-the-build-stderr': 'warn' },
    record: ({ run, runDir }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.deepEqual(
        attempt?.checks.map((c) => [c.command.split(';')[0], c.label, c.exitCode, c.turn]),
        [
          ['test -f out.txt', 'before', 1, 0],
          ['cat out.txt', 'after', 0, 1],
        ],
      )
      const ref = attempt?.files.execs
      assert.ok(ref, 'files.execs')
      const lines = readFileSync(join(runDir, ref.path), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
      assert.deepEqual(
        lines.map((l) => [l.label, l.exitCode, l.turn, l.stderr]),
        [
          ['before', 1, 0, ''],
          ['after', 0, 1, 'warn\n'],
        ],
      )
      const out: string = lines[1].stdout
      assert.match(out, /^built\na{1000}/)
      assert.match(out, /\[reeval: truncated \d+ of 200007 characters, sha256 [0-9a-f]{64}\]/)
      assert.ok(out.length < 132 * 1024, `capped at 128 KiB, got ${out.length}`)
    },
  },
  {
    dir: 'history/kept-workspace',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: zeroBy('has-file:lib/app.js'),
    record: ({ run, runDir, stdout }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      const { workspace, workspaceManifest } = attempt?.files ?? {}
      assert.ok(workspace && workspaceManifest, 'files.workspace and files.workspaceManifest')
      const archive = readFileSync(join(runDir, workspace.path))
      assert.equal(sha256(archive), workspace.sha256)
      assert.deepEqual(attempt?.workspace, {
        files: 4,
        bytes: archive.length,
        excluded: ['node_modules/'],
        masked: ['.env'],
        dropped: ['blob.bin'],
        skipped: null,
      })
      assert.match(
        stdout,
        /workspace kept without a file the secret scan found something in: blob\.bin/,
      )
      const manifest = JSON.parse(readFileSync(join(runDir, workspaceManifest.path), 'utf8'))
      assert.deepEqual(
        manifest.files.map((f: { path: string; executable?: true }) => [f.path, !!f.executable]),
        [
          ['.env', false],
          ['.gitignore', false],
          ['bin/run.sh', true],
          ['src/app.js', false],
        ],
        "dist/ is the workspace's own ignore, and node_modules/ is left out by name",
      )
      const app = readTar(gunzipSync(archive)).find((e) => e.path === 'src/app.js')
      assert.equal(app?.type === 'file' && app.data.toString(), 'export const answer = 42\n')
      const env = readTar(gunzipSync(archive)).find((e) => e.path === '.env')
      assert.ok(env?.type === 'file' && !env.data.toString().includes('ghp_'), 'masked')
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]
      assert.equal(canary?.workspace?.files, 4, 'a failed attempt keeps its workspace too')
    },
  },
  {
    dir: 'history/eval-error',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: /the build fails/,
    record: ({ run, stdout }) => {
      const failure = (name: string) => run.evals.find((e) => e.name === name)?.attempts[0]?.failure
      assert.equal(failure('lands'), undefined, 'a task that throws nothing has no failure')
      const thrown = failure('canary')
      assert.deepEqual(
        { ...thrown, stack: undefined },
        {
          kind: 'task',
          reason: 'the build fails',
          meta: { exitCode: 3, stderr: 'no src/main.js' },
          turn: 1,
          stack: undefined,
        },
      )
      assert.match(
        thrown?.stack ?? '',
        /^EvalError: the build fails\n +at built \(evals\/build\.ts:/,
      )
      assert.match(
        stdout,
        /the build fails\n[│ ]+exitCode: 3\n[│ ]+stderr: no src\/main\.js\n[│ ]+after turn 1$/m,
      )
    },
  },
  {
    dir: 'grade/code-graders',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: /^score 0\.75 below 1: answers-41 scored 0\.00$/,
    record: ({ run }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.equal(attempt?.score, 1)
      assert.deepEqual(
        attempt?.grades?.map((g) => [g.grader, g.kind, g.grade, g.score, g.error]),
        [
          ['answers-42', 'code', true, 1, undefined],
          ['masked', 'code', true, 1, undefined],
          ['observed', 'code', 1, 1, undefined],
          ['ran', 'code', 'export const answer = 42\n', 1, undefined],
          ['turns', 'code', 1, null, undefined],
        ],
      )
      const [answers, masked, observed] = attempt?.grades ?? []
      assert.deepEqual(
        answers?.reads.files?.map((f) => f.path),
        ['src/app.js'],
      )
      assert.match(masked?.reads.files?.[0]?.sha256 ?? '', /^[0-9a-f]{64}$/)
      assert.deepEqual(observed?.reads.observations, [
        { name: 'lines', sha256: sha256(JSON.stringify(1)) },
      ])
      assert.match(answers?.fingerprint.digest ?? '', /^[0-9a-f]{64}$/)
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]
      assert.equal(canary?.score, 0.75)
      assert.equal(
        canary?.grades?.find((g) => g.grader === 'masked')?.fingerprint.digest,
        masked?.fingerprint.digest,
        'the same grader on another eval has the same fingerprint',
      )
    },
  },
  {
    dir: 'grade/sandboxed',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: /^score 0\.50 below 1: hidden-wrong scored 0\.50$/,
    record: ({ run, tier }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.equal(attempt?.score, 1)
      assert.deepEqual(
        attempt?.grades?.map((g) => [g.grader, g.grade, g.score, g.error]),
        [
          ['hidden-add', 2, 1, undefined],
          ['scoped', true, 1, undefined],
          ...(tier === 'docker' ? [['offline', 3, 1, undefined]] : []),
        ],
      )
      const [hidden] = attempt?.grades ?? []
      assert.deepEqual(
        hidden?.reads.files?.map((f) => f.path),
        ['package.json', 'src/add.js'],
      )
      assert.match(hidden?.fingerprint.image ?? '', /^[0-9a-f]{64}$/)
      assert.match(hidden?.fingerprint.data ?? '', /^[0-9a-f]{64}$/)
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]
      const wrong = canary?.grades?.[0]
      assert.equal(wrong?.grade, 1)
      assert.equal(
        wrong?.fingerprint.image,
        hidden?.fingerprint.image,
        'the same env, the same image',
      )
      assert.notEqual(wrong?.fingerprint.data, hidden?.fingerprint.data)
    },
  },
  {
    dir: 'grade/score',
    tiers: ['fake'],
    env: 'plain',
    lands: {
      outcome: 'fail',
      error: { kind: 'assertion', message: /^score 0\.75 below 1: tests scored 0\.00$/ },
    },
    canary: /^score 0\.00 below 1: tests scored 0\.00; strict \(required\) scored 0\.50$/,
    record: ({ run }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.equal(attempt?.score, 0.75)
      assert.deepEqual(
        attempt?.grades?.map((g) => [g.grader, g.group, g.score, g.weight, g.required]),
        [
          ['builds', ['builds', 'tests'], 1, 3, false],
          ['tests', ['builds', 'tests'], 0, 1, false],
          ['ignored', undefined, 0, 0, false],
          ['note', undefined, null, 1, false],
        ],
      )
      const [builds, tests] = attempt?.grades ?? []
      assert.deepEqual(builds?.grade, { built: true, passed: 0 }, "the group's one grade")
      assert.deepEqual(tests?.grade, builds?.grade)
      assert.notEqual(builds?.scoreDigest, tests?.scoreDigest, 'each scores it its own way')
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]
      assert.equal(canary?.score, 0)
    },
  },
  {
    dir: 'grade/builtin-trajectory',
    tiers: ['fake'],
    env: 'skilled',
    canary: zeroBy('called-tool:Edit (required)'),
    record: ({ run }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.equal(attempt?.score, 1)
      assert.deepEqual(
        attempt?.grades?.map((g) => [g.grader, g.kind, g.grade, g.score]),
        [
          ['used-skill:foo', 'builtin', true, 1],
          ['used-skill', 'builtin', ['foo'], 1],
          ['called-tool:Read', 'builtin', 1, 1],
          ['called-mcp:docs/search', 'builtin', 1, 1],
          ['ran:/echo built/', 'builtin', 1, 1],
          ['wrote:src/client.ts', 'builtin', ['src/client.ts'], 1],
        ],
      )
      const [skill] = attempt?.grades ?? []
      assert.equal(skill?.fingerprint.version, 1)
      assert.equal(skill?.scoreDigest, undefined, 'a natural pass has no score function')
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]
      assert.equal(
        canary?.grades?.[0]?.fingerprint.digest,
        skill?.fingerprint.digest,
        'one built-in on two evals has one fingerprint',
      )
    },
  },
  {
    dir: 'grade/builtin-workspace',
    tiers: ['fake', 'docker'],
    env: 'app',
    canary: zeroBy('not-in-diff:src/** (required)'),
    record: async ({ run, runDir }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.equal(attempt?.score, 1)
      const live = attempt?.grades?.map((g) => [g.grader, g.grade, g.score, g.weight])
      assert.deepEqual(live, [
        ['has-file:src/retry.ts', true, 1, 1],
        ['has-file:src/missing.ts', false, 0, 0],
        ['in-diff:src/**', ['src/retry.ts'], 1, 1],
        ['not-in-diff:test/**/*.test.ts', [], 1, 1],
        ['in-diff:**/*.js', [], 0, 0],
        ['not-in-diff:**/package.json', [], 1, 1],
      ])
      const graders = [
        hasFile('src/retry.ts', /export function retry/, { required: true }),
        hasFile('src/missing.ts', { weight: 0 }),
        inDiff('src/**'),
        notInDiff('test/**/*.test.ts', { required: true }),
        inDiff('**/*.js', { weight: 0 }),
        notInDiff('**/package.json', { required: true }),
      ].map((g) => graderDef(g) as GraderDef)
      const stored = attempt && {
        case: { key: '' },
        turns: [],
        skills: [],
        stored: await readStoredAttempt(runDir, attempt),
      }
      const regraded = stored && (await runGraders(graders, stored, new AbortController().signal))
      assert.deepEqual(
        regraded?.map((g) => [g.grader, g.grade, g.score, g.weight]),
        live,
        'a regrade from the stored record gives the live grades',
      )
      assert.deepEqual(
        attempt?.grades?.[0]?.reads.files?.map((f) => f.path),
        ['src/retry.ts'],
        'hasFile reads the kept file with no files declared',
      )
    },
  },
  {
    dir: 'grade/builtin-execs',
    tiers: ['fake'],
    env: 'plain',
    canary: zeroBy('succeeded:tests'),
    record: ({ run }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.equal(attempt?.score, 1)
      assert.deepEqual(
        attempt?.grades?.map((g) => [g.grader, g.grade, g.score]),
        [
          ['succeeded:tests', 0, 1],
          ['succeeded:echo built', 0, 1],
          ['observed:health', 200, 1],
          ['observed:ready', true, 1],
          ['observed:lines', 3, null],
        ],
      )
      const health = attempt?.grades?.[2]
      assert.match(
        health?.scoreDigest ?? '',
        /^[0-9a-f]{64}$/,
        "the predicate is the grader's score",
      )
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]
      assert.equal(canary?.grades?.[0]?.grade, 3)
    },
  },
  {
    dir: 'grade/builtin-usage',
    tiers: ['fake'],
    env: 'plain',
    canary: zeroBy('within-limits (required)'),
    record: ({ run }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.equal(attempt?.score, 1)
      const grades = attempt?.grades ?? []
      assert.deepEqual(
        grades.map((g) => [g.grader, g.score, g.weight]),
        [
          ['tokens', null, 1],
          ['within-limits', 1, 1],
          ['turns', 1, 1],
          ['cost', null, 1],
          ['duration', null, 1],
        ],
        "the config's graders come first, and the eval's turns replaces the config's",
      )
      const [tokens, limits, turns, cost] = grades
      assert.equal(tokens?.grade, 2400)
      assert.deepEqual(
        { ...(limits?.grade as object), duration: undefined },
        { tokens: 2400, toolCalls: { bash: 4 }, duration: undefined, cost: 0.02 },
      )
      assert.equal(turns?.grade, 2)
      assert.match(turns?.scoreDigest ?? '', /^[0-9a-f]{64}$/)
      assert.equal(cost?.grade, 0.02)
    },
  },
  {
    dir: 'grade/builtin-page',
    tiers: ['fake'],
    env: 'ui',
    canary: zeroBy('page-status:old (required)'),
    record: ({ run }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.equal(attempt?.score, 1)
      assert.deepEqual(
        attempt?.grades?.map((g) => [g.grader, g.grade, g.score, g.reads.artifacts?.[0]?.name]),
        [
          ['page-status:home', 200, 1, 'home'],
          ['page-status:old', 404, 1, 'old'],
          ['no-page-errors:home', 0, 1, 'home'],
        ],
      )
    },
  },
  {
    dir: 'grade/judge-boolean',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: /^score 0\.50 below 1: says-41 scored 0\.00$/,
    record: ({ run }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.equal(attempt?.score, 1)
      const [grade] = attempt?.grades ?? []
      assert.deepEqual(
        [grade?.grader, grade?.kind, grade?.grade, grade?.score, grade?.scoreDigest],
        ['judge:Does src/app.js export answer?', 'judge', true, 1, undefined],
        "a yes/no question's grade is the answer, and yes scores 1",
      )
      assert.deepEqual(grade?.judge?.calls, [{ model: 'fake', answer: true, probability: 0.9 }])
      assert.deepEqual(
        grade?.reads.files?.map((f) => f.path),
        ['src/app.js'],
        'contents reads the kept workspace',
      )
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]
      assert.equal(
        canary?.grades?.[0]?.fingerprint.digest,
        grade?.fingerprint.digest,
        'the same judge grader on another eval has the same fingerprint',
      )
    },
  },
  {
    dir: 'grade/judge-labels',
    tiers: ['fake'],
    env: 'plain',
    canary: /^score 0\.50 below 1: harsh scored 0\.50$/,
    record: ({ run }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.equal(attempt?.score, 1)
      assert.deepEqual(
        attempt?.grades?.map((g) => [g.grader, g.grade, g.score]),
        [
          ['judge:How readable is the change?', ['good', 'good'], 1],
          ['judge:What tone does the reply take?', 'terse', null],
        ],
        'one answer per model, and answers with no score record only',
      )
      const [readable, tone] = attempt?.grades ?? []
      assert.match(readable?.scoreDigest ?? '', /^[0-9a-f]{64}$/, 'the score map is digested apart')
      assert.equal(tone?.scoreDigest, undefined)
      assert.deepEqual(
        readable?.judge?.calls?.map((c) => c.answer),
        ['good', 'good'],
      )
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]
      assert.deepEqual(canary?.grades?.[0]?.grade, ['good', 'poor'])
      assert.equal(canary?.grades?.[0]?.score, 0.5, "the mean of each model's answer's score")
    },
  },
  {
    dir: 'grade/judge-reference',
    tiers: ['fake'],
    env: 'plain',
    canary: zeroBy('matches-reference'),
    evals: {
      lands: { outcome: 'pass', attempts: ['fake/plain/fake#answer#1'] },
      canary: {
        outcome: 'fail',
        attempts: ['fake/plain/fake#answer#1'],
        error: {
          kind: 'assertion',
          message: zeroBy('matches-reference'),
        },
      },
    },
    record: ({ run }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]
      const [grade] = attempt?.grades ?? []
      const [missed] = canary?.grades ?? []
      assert.equal(grade?.grade, true, "the case's reference matches the attempt")
      assert.equal(grade?.judge?.reference?.files, 1)
      assert.match(grade?.fingerprint.reference ?? '', /^[0-9a-f]{64}$/)
      assert.equal(grade?.judge?.reference?.digest, grade?.fingerprint.reference)
      assert.notEqual(
        missed?.fingerprint.reference,
        grade?.fingerprint.reference,
        "each case's reference is its own part of the fingerprint",
      )
      assert.equal(grade?.fingerprint.code, missed?.fingerprint.code)
      assert.deepEqual(
        grade?.reads.files?.map((f) => f.path),
        ['src/app.js'],
        'the diff against the reference reads the kept workspace',
      )
    },
  },
  {
    dir: 'grade/judge-builtins',
    tiers: ['fake'],
    env: 'plain',
    canary: /^score 0\.50 below 1: judge:Does the change touch test\/\? scored 0\.00$/,
    record: async ({ run, runDir }) => {
      const attempt = run.evals.find((e) => e.name === 'lands')?.attempts[0]
      assert.equal(attempt?.score, 1)
      const live = attempt?.grades?.map((g) => [g.grader, g.kind, g.grade, g.score])
      assert.deepEqual(
        live,
        [
          ['turns', 'builtin', 1, null],
          ['judge:Does the change add two files under node_modules/?', 'judge', true, 1],
          ['in-diff:src/**', 'builtin', ['src/retry.ts'], 1],
          ['has-file:src/retry.ts', 'builtin', true, 1],
        ],
        "the config's built-in, then the eval's judge grader and built-ins",
      )
      const twoDependencyFiles = judge('Does the change add two files under node_modules/?', {
        inputs: { files: true },
        model: fakeJudge({
          score: (state) =>
            JSON.stringify(state).includes('changed node_modules/ (2 files)') ? 0.9 : 0.1,
        }),
      })
      const graders = [twoDependencyFiles, inDiff('src/**'), hasFile('src/retry.ts')].map(
        (g) => graderDef(g) as GraderDef,
      )
      const stored: GradeInputs | undefined = attempt && {
        case: { key: '' },
        turns: [],
        skills: [],
        stored: await readStoredAttempt(runDir, attempt),
        judge: {
          ask: (q, a, state, model, signal) => askJudge(q, a, state, { model }, signal),
        },
      }
      const regraded = stored && (await runGraders(graders, stored, new AbortController().signal))
      assert.deepEqual(
        regraded?.map((g) => [g.grader, g.kind, g.grade, g.score, g.fingerprint.digest]),
        attempt?.grades
          ?.slice(1)
          .map((g) => [g.grader, g.kind, g.grade, g.score, g.fingerprint.digest]),
        'a regrade from the stored record gives the live grades, the judge seeing the same files',
      )
    },
  },
  {
    dir: 'assert/exec-env',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: zeroBy('succeeded:greets'),
    canaryGraded: { 'succeeded:greets': 1 },
  },
  {
    dir: 'assert/exec-retries',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: zeroBy('succeeded:flaky passes'),
    canaryGraded: { 'succeeded:flaky passes': 1 },
    record: ({ run, runDir }) => {
      const check = (name: string) => run.evals.find((e) => e.name === name)?.attempts[0]?.checks[0]
      const lands = check('lands')
      assert.equal(lands?.exitCode, 0)
      assert.equal(lands?.retries, 2)
      assert.deepEqual(
        lands?.tries?.map((t) => t.exitCode),
        [1, 0],
      )
      assert.ok(lands?.log)
      const log = readFileSync(join(runDir, lands.log.path), 'utf8')
      assert.match(log, /^exit 0, passed on try 2 of 3$/m)
      assert.match(log, /^try 1 of 3: exit 1 after .+\n--- stdout\n--- stderr\ntransient$/m)
      const canary = check('canary')
      assert.equal(canary?.exitCode, 1)
      assert.equal(canary?.retries, undefined, 'a check without retries records no tries')
      assert.equal(canary?.tries, undefined)
    },
  },
  {
    dir: 'assert/called-skill',
    tiers: ['fake'],
    env: 'plain',
    canary: zeroBy('used-skill:other'),
  },
  {
    dir: 'assert/called-skill-path',
    tiers: ['fake'],
    env: 'skilled',
    canary: zeroBy('used-skill:other'),
  },
  {
    dir: 'assert/called-mcp',
    tiers: ['fake'],
    env: 'plain',
    canary: zeroBy('called-mcp:stamp/other'),
  },
  {
    dir: 'assert/called-tool-mcp',
    tiers: ['fake'],
    env: 'plain',
    canary: zeroBy('called-tool:mcp__stamp__other'),
  },
  {
    dir: 'assert/stay-within',
    tiers: ['fake'],
    env: 'plain',
    canary: zeroBy('within-limits'),
    record: ({ run }) => {
      const [limits, calls] = graded(run, 'lands') ?? []
      assert.deepEqual(limits?.slice(0, 1), ['within-limits'])
      assert.deepEqual(
        { ...(limits?.[1] as object), duration: 0 },
        {
          tokens: 1200,
          toolCalls: { bash: 2 },
          duration: 0,
        },
      )
      assert.deepEqual(calls, ['tool-calls', { toolCalls: 2 }, 1])
      assert.deepEqual(graded(run, 'canary'), [['within-limits', { tokens: 1200 }, 0]])
    },
  },
  {
    dir: 'assert/stay-within-unreported',
    tiers: ['fake'],
    env: 'plain',
    lands: {
      outcome: 'fail',
      error: {
        kind: 'assertion',
        message:
          /^score 0\.00 below 1: within-limits errored: a turn's harness reported no token usage, so tokens can't be checked$/,
      },
    },
    canary: zeroBy('within-limits'),
    record: ({ run }) => {
      const [grade] = landed(run)?.grades ?? []
      assert.equal(grade?.grade, undefined, 'an unreported usage is an error, not a failed check')
      assert.match(grade?.error ?? '', /no token usage/)
      assert.equal(
        (
          run.evals.find((e) => e.name === 'canary')?.attempts[0]?.grades?.[0]?.grade as {
            toolCalls?: number
          }
        )?.toolCalls,
        1,
      )
    },
  },
  {
    dir: 'assert/ran',
    tiers: ['fake'],
    env: 'plain',
    canary: zeroBy('ran:/deploy/'),
  },
  {
    dir: 'assert/ran-program',
    tiers: ['fake'],
    env: 'plain',
    canary: zeroBy('ran:program deploy'),
    canaryGraded: { commands: ['echo deploy-skipped && TOKEN=1 printf contract-42'] },
  },
  {
    dir: 'assert/edited',
    tiers: ['fake'],
    env: 'plain',
    canary: zeroBy('wrote:other.txt'),
  },
  {
    dir: 'assert/changed',
    tiers: ['fake', 'docker'],
    env: 'seeded',
    canary: zeroBy('not-in-diff:test/**'),
    record: ({ run }) =>
      assert.deepEqual(graded(run, 'canary'), [['not-in-diff:test/**', ['test/greet.test.js'], 0]]),
  },
  {
    dir: 'assert/changed-quoted-path',
    tiers: ['fake', 'docker'],
    env: 'notes',
    canary: zeroBy('not-in-diff:notes/café.txt'),
    canaryGraded: { 'not-in-diff:notes/café.txt': ['notes/café.txt'] },
    record: ({ run }) =>
      assert.deepEqual(landed(run)?.changedFiles, [
        { path: 'notes/café.txt', status: 'added', added: 1, removed: 0 },
      ]),
  },
  {
    dir: 'judge/input-contents',
    tiers: ['fake'],
    env: 'readme-app',
    canary: zeroBy('readme-matches'),
    record: ({ run }) =>
      assert.deepEqual(
        judgeGradeOf(run).reads.files?.map((f) => f.path),
        ['README.md', 'src/app.ts'],
      ),
  },
  {
    dir: 'judge/artifacts',
    tiers: ['fake', 'docker'],
    env: 'ui',
    canary: zeroBy('shows-the-error'),
    record: ({ run }) =>
      assert.deepEqual(
        judgeGradeOf(run).reads.artifacts?.map((a) => a.name),
        ['form'],
      ),
  },
  {
    dir: 'judge/artifacts-all',
    tiers: ['fake', 'docker'],
    env: 'ui',
    canary: zeroBy('shows-the-error'),
    record: ({ run }) =>
      assert.deepEqual(
        judgeGradeOf(run).reads.artifacts?.map((a) => a.name),
        ['empty', 'filled'],
      ),
  },
  {
    dir: 'ui/capture',
    tiers: ['fake', 'docker'],
    env: 'ui',
    canary: zeroBy('observed:home'),
    canarySaw: { home: { path: 'artifacts/home.png' } },
    record: ({ run, runDir, tier }) => {
      const art = landed(run)?.files.artifacts?.[0]
      assert.ok(art, 'files.artifacts names the PNG')
      assert.match(art.path, /artifacts\/home\.png$/)
      assert.equal(art.name, 'home')
      assert.equal(art.mediaType, 'image/png')
      const bytes = readFileSync(join(runDir, art.path))
      const viewport = art.capture?.viewport ?? { width: 1280, height: 720 }
      const port = art.capture?.port ?? 0
      if (tier === 'fake') {
        assert.deepEqual(bytes, stubPng('home', port, '/', viewport))
      } else {
        assert.deepEqual(pngSize(bytes), viewport)
      }
    },
  },
  {
    // Docker only: the fake sandbox has no browser to report a console or page errors.
    dir: 'ui/capture-page',
    tiers: ['docker'],
    env: 'ui',
    args: ['-v'],
    canary: zeroBy('no-page-errors:home'),
    record: ({ run, runDir, stdout }) => {
      const art = landed(run)?.files.artifacts?.[0]
      assert.equal(art?.capture?.status, 200)
      assert.equal(art?.capture?.pageErrors, 2)
      const ref = art?.capture?.page
      assert.match(ref?.path ?? '', /artifacts\/home\.capture\.json$/)
      const page = JSON.parse(readFileSync(join(runDir, ref?.path ?? ''), 'utf8'))
      assert.equal(page.finalUrl, '/sign-up')
      assert.equal(page.errors.length, 2)
      assert.deepEqual(page.failedRequests, [{ method: 'GET', url: '/missing.js', status: 404 }])
      assert.match(
        entryOf(stdout, 'lands'),
        new RegExp(
          `^ +Worth knowing: 2 page errors in capture "home" → \\.reeval/runs/${run.runId}/.+/artifacts/home\\.capture\\.json$`,
          'm',
        ),
      )
      assert.match(
        stdout,
        /capture "home" at \/sign-up \(200\): 2 page errors · \d+ console messages · 1 failed request/,
      )
      assert.match(stdout, /capture "home" page error: Uncaught Error: late failure/)
      assert.match(stdout, /capture "home" failed request: GET \/missing\.js → 404/)
    },
  },
  {
    // Docker only: the fake sandbox has no browser to log to.
    dir: 'ui/capture-loud',
    tiers: ['docker'],
    env: 'ui',
    canary: zeroBy('has-page-errors'),
    record: ({ run, runDir }) => {
      const art = landed(run)?.files.artifacts?.[0]
      assert.equal(art?.capture?.pageErrors, undefined)
      const page = JSON.parse(readFileSync(join(runDir, art?.capture?.page?.path ?? ''), 'utf8'))
      assert.equal(page.schemaVersion, 1)
      assert.equal(page.dropped, 1201)
      assert.ok(page.console.every((m: { text: string }) => m.text.length <= 2001))
    },
  },
  {
    dir: 'ui/capture-status',
    tiers: ['fake', 'docker'],
    env: 'ui',
    canary: zeroBy('page-status:old'),
    record: ({ run, runDir, stdout }) => {
      const art = landed(run)?.files.artifacts?.[0]
      assert.equal(art?.capture?.status, 404)
      assert.equal(art?.capture?.pageErrors, undefined)
      const page = JSON.parse(readFileSync(join(runDir, art?.capture?.page?.path ?? ''), 'utf8'))
      assert.equal(page.status, 404)
      assert.equal(page.finalUrl, '/login')
      assert.doesNotMatch(entryOf(stdout, 'lands'), /page error/)
    },
  },
  {
    dir: 'ui/capture-concurrent',
    tiers: ['fake', 'docker'],
    env: 'ui',
    canary: zeroBy('observed:home'),
    canarySaw: { home: { path: 'artifacts/home.png' } },
    record: ({ run, runDir, tier }) => {
      const arts = landed(run)?.files.artifacts ?? []
      assert.equal(arts.length, 2, 'both concurrent captures land')
      assert.deepEqual(arts.map((a) => a.name).sort(), ['about', 'home'])
      for (const art of arts) {
        assert.match(art.path, new RegExp(`artifacts/${art.name}\\.png$`))
        const bytes = readFileSync(join(runDir, art.path))
        const viewport = art.capture?.viewport ?? { width: 1280, height: 720 }
        const port = art.capture?.port ?? 0
        const path = art.capture?.path ?? '/'
        if (tier === 'fake') {
          assert.deepEqual(bytes, stubPng(art.name, port, path, viewport))
        } else {
          assert.deepEqual(pngSize(bytes), viewport)
        }
      }
    },
  },
  {
    dir: 'ui/capture-unreachable',
    tiers: ['fake', 'docker'],
    env: 'plain',
    lands: {
      outcome: 'fail',
      error: {
        kind: 'assertion',
        message: /nothing listening on port 59999/,
      },
    },
    canary: zeroBy('observed:error'),
    canarySaw: { error: 'nothing listening on port 59999' },
  },
  {
    dir: 'ui/background-compound',
    tiers: ['fake', 'docker'],
    env: 'plain',
    canary: zeroBy('observed:bg.txt'),
    canarySaw: { 'bg.txt': 'started' },
  },
  {
    dir: 'ui/serve-redirect',
    tiers: ['fake', 'docker'],
    env: 'ui',
    canary: zeroBy('observed:served.log'),
    canarySaw: { 'served.log': { line: /^listening on \d+$/ } },
  },
  {
    dir: 'ui/serve-kill',
    tiers: ['fake', 'docker'],
    env: 'ui',
    canary: zeroBy('observed:probe'),
    canarySaw: { probe: 'down' },
  },
  {
    dir: 'ui/serve-own-port',
    tiers: ['docker', 'podman'],
    env: 'ui',
    canary: zeroBy('observed:probe'),
    canarySaw: { probe: 'vite' },
    record: ({ run }) => {
      const [serve, ...more] = landed(run)?.serves ?? []
      assert.ok(serve, 'serves names the c.serve call')
      assert.deepEqual(more, [])
      assert.equal(serve.command, 'node vite.mjs')
      assert.equal(serve.detected, true)
      assert.equal(serve.address, '::1')
      assert.equal(serve.port, 5173)
      assert.notEqual(serve.portEnv, 5173)
      assert.equal(landed(run)?.files.artifacts?.[0]?.capture?.port, serve.port)
    },
  },
  {
    // tart() on the fake `tart`, which has the image already: the run clones it and pulls nothing.
    dir: 'sandbox/tart-clones-image',
    tiers: ['fake'],
    env: 'mac',
    sandbox: 'tart:macos-sequoia-base:15.6',
    posixModes: true,
    loopback: true,
    canary: zeroBy('observed:image'),
    canarySaw: { image: 'ghcr.io/cirruslabs/macos-sequoia-base:15.6' },
    hostEnv: (dir) => {
      const fake = fakeTart(['ghcr.io/cirruslabs/macos-sequoia-base:15.6'])
      fakeTarts.set(dir, fake.dir)
      return { ...fake.env, REEVAL_TEST_TART_ANY_HOST: '1' }
    },
    record: ({ run, project, stdout }) => {
      const image = 'ghcr.io/cirruslabs/macos-sequoia-base:15.6'
      assert.deepEqual(landed(run)?.vmImage, { ref: image, digest: fakeDigest(image) })
      assert.ok(landed(run)?.resources?.machine.id?.startsWith(vmPrefix(run.runId)))
      const log = readFileSync(join(fakeTarts.get(project) ?? '', 'log'), 'utf8')
      assert.doesNotMatch(log, /^pull /m, 'the run pulled nothing')
      assert.doesNotMatch(stdout, /moving tag/, 'a pinned tag has no warning')
    },
  },
  ...perHarness(TART_HARNESSES, (layout) => ({
    // tart() on the fake `tart`: the agent runs on the VM's harness session, whose gateway brokers
    // and, for a harness whose bridge is a server, tunnels the session's port to it.
    dir: 'sandbox/tart-brokered-agent',
    tiers: ['fake'],
    env: 'mac',
    sandbox: 'tart:macos-sequoia-base:15.6',
    posixModes: true,
    loopback: true,
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["reeval_fake_/ },
    hostEnv: (dir) => {
      const fake = fakeTart(['ghcr.io/cirruslabs/macos-sequoia-base:15.6'])
      fakeTarts.set(dir, fake.dir)
      return {
        ...fake.env,
        REEVAL_TEST_TART_ANY_HOST: '1',
        REEVAL_FIXTURE_CREDENTIAL: fakeBrokering(layout).credential,
        [fakeBrokering(layout).credential]: 'key_tart_fixture',
      }
    },
    record: ({ project, runDir }) => {
      assert.equal(filesContaining(runDir, 'key_tart_fixture'), '')
      const vms = join(fakeTarts.get(project) ?? '', 'vms')
      assert.deepEqual(readdirSync(vms), [], 'every VM is deleted')
    },
  })),
  {
    // tart({ hosts }) on fake Macs that a fake ssh reaches, with no Tart host check on this machine:
    // the VM runs on a host, and the gateway brokers from here.
    dir: 'sandbox/tart-hosts-run',
    tiers: ['fake'],
    env: 'mac',
    sandbox: 'tart:macos-sequoia-base:15.6',
    posixModes: true,
    loopback: true,
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["\// },
    hostEnv: (dir) => {
      const image = 'ghcr.io/cirruslabs/macos-sequoia-base:15.6'
      const fake = fakeTartHosts({
        'mac-studio': { images: [image] },
        'mac-mini.local': { images: [image] },
      })
      fakeTarts.set(dir, fake.dir)
      return { ...fake.env, CURSOR_API_KEY: 'key_tart_hosts_fixture_cursor' }
    },
    record: ({ project, runDir }) => {
      assert.equal(filesContaining(runDir, 'key_tart_hosts_fixture_cursor'), '')
      const root = fakeTarts.get(project) ?? ''
      // Every command each Mac ran, and what its VMs kept: the key stays on this machine.
      assert.equal(filesContaining(join(root, 'hosts'), 'key_tart_hosts_fixture_cursor'), '')
      const log = readFileSync(join(root, 'log'), 'utf8')
      assert.doesNotMatch(log, /^(clone|run) /m, "nothing ran on this machine's Tart")
      const hosts = ['mac-studio', 'mac-mini.local']
      const clones = hosts.flatMap(
        (h) => readFileSync(join(root, 'hosts', h, 'log'), 'utf8').match(/^clone /gm) ?? [],
      )
      assert.equal(clones.length, 2, 'one clone per attempt, on the hosts')
      for (const h of hosts) {
        assert.deepEqual(readdirSync(join(root, 'hosts', h, 'vms')), [], `${h} keeps no VM`)
      }
    },
  },
  {
    // tart({ hosts }): the run's lease counts the hosts preflight kept, at the VMs each has memory
    // for, so an attempt waits for its lease rather than on a full host.
    dir: 'sandbox/tart-hosts-cap',
    tiers: ['fake'],
    env: 'mac',
    sandbox: 'tart:macos-sequoia-base:15.6',
    posixModes: true,
    loopback: true,
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["\/(?![^"]*\/hosts\/small\/)/ },
    hostEnv: (dir) => {
      const image = 'ghcr.io/cirruslabs/macos-sequoia-base:15.6'
      const fake = fakeTartHosts({
        'mac-studio': { images: [image] },
        small: { images: [image], memsize: 8 * 1024 ** 3 },
      })
      fakeTarts.set(dir, fake.dir)
      return fake.env
    },
    record: ({ run, project }) => {
      for (const e of run.evals) assert.notEqual(e.attempts[0]?.outcome, 'infra_error', e.name)
      const logs = filesUnder(join(project, '.reeval', 'debug'))
        .filter((f) => f.endsWith('debug.log'))
        .map((f) => readFileSync(f, 'utf8'))
      assert.equal(logs.length, 2, 'both attempts ran')
      assert.doesNotMatch(logs.join('\n'), /every host is at its VM limit/)
      const root = fakeTarts.get(project) ?? ''
      assert.doesNotMatch(readFileSync(join(root, 'hosts', 'small', 'log'), 'utf8'), /^clone /m)
    },
  },
  {
    // tart({ hosts }): a host whose `tart run` says it's at its VM limit is busy, not broken.
    dir: 'sandbox/tart-hosts-busy',
    tiers: ['fake'],
    env: 'mac',
    sandbox: 'tart:macos-sequoia-base:15.6',
    posixModes: true,
    loopback: true,
    canary: zeroBy('observed:pwd'),
    canarySaw: { pwd: /\/hosts\/free\/vms\// },
    hostEnv: (dir) => {
      const image = 'ghcr.io/cirruslabs/macos-sequoia-base:15.6'
      const fake = fakeTartHosts({ full: { images: [image], limit: 0 }, free: { images: [image] } })
      fakeTarts.set(dir, fake.dir)
      return fake.env
    },
    record: ({ run, project }) => {
      for (const e of run.evals) assert.notEqual(e.attempts[0]?.outcome, 'infra_error', e.name)
      const root = fakeTarts.get(project) ?? ''
      const full = readFileSync(join(root, 'hosts', 'full', 'log'), 'utf8')
      assert.match(full, /^run reeval-\S+ --no-graphics$/m, 'full was tried first')
      assert.deepEqual(readdirSync(join(root, 'hosts', 'full', 'vms')), [], 'its clone deleted')
    },
  },
  {
    // tart() on the fake `tart`: preflight bakes the agent's bootstrap into an image of its own,
    // which every attempt clones.
    dir: 'sandbox/tart-baked-harness',
    tiers: ['fake'],
    env: 'mac',
    sandbox: 'tart:macos-sequoia-base:15.6',
    posixModes: true,
    loopback: true,
    canary: zeroBy('observed:agent-saw'),
    canarySaw: { 'agent-saw': /^\["baked"/ },
    hostEnv: (dir) => {
      const fake = fakeTart(['ghcr.io/cirruslabs/macos-sequoia-base:15.6'])
      fakeTarts.set(dir, fake.dir)
      return { ...fake.env, REEVAL_TEST_TART_ANY_HOST: '1' }
    },
    record: ({ run, project }) => {
      const image = 'ghcr.io/cirruslabs/macos-sequoia-base:15.6'
      assert.deepEqual(landed(run)?.vmImage, { ref: image, digest: fakeDigest(image) })
      const log = readFileSync(join(fakeTarts.get(project) ?? '', 'log'), 'utf8')
      const baked = /^rename \S+ (reeval-sandbox-fake-\S+)$/m.exec(log)?.[1]
      assert.ok(baked, `preflight baked an image\n${log}`)
      assert.equal(log.match(/^rename /gm)?.length, 1, 'once for both attempts')
      assert.equal(log.match(new RegExp(`^clone ${baked} `, 'gm'))?.length, 2)
      const vms = readdirSync(join(fakeTarts.get(project) ?? '', 'vms'))
      assert.deepEqual(vms, [baked], 'the baked image stays, and every clone is deleted')
    },
  },
  {
    // tart() on the fake `tart` (test/support/fake-tart.ts), whose VMs list only their own listeners.
    dir: 'ui/serve-tart-own-port',
    tiers: ['fake'],
    env: 'ui',
    sandbox: 'tart:macos-sequoia-base:latest',
    posixModes: true,
    loopback: true,
    canary: zeroBy('observed:probe'),
    canarySaw: { probe: 'own port' },
    hostEnv: (dir) => {
      const fake = fakeTart(['ghcr.io/cirruslabs/macos-sequoia-base:latest'])
      fakeTarts.set(dir, fake.dir)
      return { ...fake.env, REEVAL_TEST_TART_ANY_HOST: '1' }
    },
    record: ({ run, project }) => {
      const [serve, ...more] = landed(run)?.serves ?? []
      assert.ok(serve, 'serves names the c.serve call')
      assert.deepEqual(more, [])
      assert.equal(serve.detected, true)
      assert.equal(serve.address, '127.0.0.1')
      assert.notEqual(serve.port, serve.portEnv)
      const vms = join(fakeTarts.get(project) ?? '', 'vms')
      assert.deepEqual(readdirSync(vms), [], 'every VM is deleted')
      const left = spawnSync('pgrep', ['-f', 'own-port.mjs'], { encoding: 'utf8' }).stdout.trim()
      assert.equal(left, '', 'and c.serve stopped its server in the VM')
      const traces = filesUnder(join(project, '.reeval', 'debug')).filter((f) =>
        f.endsWith('trace.ndjson'),
      )
      const traced = traces.map((f) => readFileSync(f, 'utf8')).join('\n')
      assert.match(
        traced,
        /"bin":"tart","args":\["clone"/,
        "the failed attempt's trace has its tart commands",
      )
    },
  },
  {
    dir: 'ui/serve-reads-port',
    tiers: ['fake', 'docker', 'podman'],
    env: 'ui',
    canary: zeroBy('observed:probe'),
    canarySaw: { probe: 'main' },
    record: ({ run }) => {
      const serve = landed(run)?.serves?.[0]
      assert.ok(serve, 'serves names the c.serve call')
      assert.equal(serve.port, serve.portEnv)
      assert.equal(serve.detected, false)
    },
  },
  {
    dir: 'ui/serve-two-ports',
    tiers: ['docker', 'podman'],
    env: 'ui',
    lands: {
      outcome: 'fail',
      error: {
        kind: 'assertion',
        message:
          /c\.serve\("node server\.mjs"\) listens on ports 4173 and 5173, and not on PORT \(\d+\)\. It printed http:\/\/localhost:5173\/\. Pass the one it serves on: c\.serve\("node server\.mjs", 5173\)/,
      },
    },
    canary: zeroBy('observed:error'),
    canarySaw: { error: /^c\.serve\("node server\.mjs"\) listens on/ },
    record: ({ run }) => assert.equal(landed(run)?.serves, undefined),
  },
  {
    dir: 'ui/serve-port-in-use',
    tiers: ['fake', 'docker', 'podman'],
    env: 'ui',
    lands: {
      outcome: 'fail',
      error: {
        kind: 'assertion',
        message:
          /c\.serve\("node server\.mjs preview \$PORT", (\d+)\): port \1 was already in use before c\.serve started \(a server the agent left running\?\), so the checks would reach that server, not this command's\. Stop it first, or drop the port to serve on PORT/,
      },
    },
    canary: zeroBy('observed:error'),
    canarySaw: { error: /^c\.serve\("node server\.mjs preview \$POR/ },
    record: ({ run }) =>
      assert.deepEqual(
        landed(run)?.serves?.map((s) => s.command),
        ['node server.mjs dev'],
      ),
  },
  {
    dir: 'ui/serve-exits',
    tiers: ['fake', 'docker', 'podman'],
    env: 'ui',
    lands: {
      outcome: 'fail',
      error: {
        kind: 'assertion',
        message:
          /c\.serve\("node server\.mjs"\) exited before it listened on .*\. Its last output:\n[\s\S]*Error: Cannot find module vite/,
      },
    },
    canary: zeroBy('observed:error'),
    canarySaw: { error: /^c\.serve\("node server\.mjs"\) exited bef/ },
  },
  {
    dir: 'ui/capture-browser-false',
    tiers: ['fake', 'docker'],
    env: 'plain',
    lands: {
      outcome: 'fail',
      error: {
        kind: 'assertion',
        message: /c\.capture\(\) is refused: capture\.browser is false/,
      },
    },
    canary: zeroBy('observed:error'),
    canarySaw: { error: /^c\.capture\(\) is refused: capture\.browser is false/ },
    record: ({ run }) => {
      assert.equal(landed(run)?.files.artifacts, undefined)
    },
  },
  {
    dir: 'ui/capture-browser-env',
    tiers: ['fake', 'docker'],
    env: 'plain',
    hostEnv: { REEVAL_CAPTURE_BROWSER: '0' },
    lands: {
      outcome: 'fail',
      error: {
        kind: 'assertion',
        message: /c\.capture\(\) is refused: REEVAL_CAPTURE_BROWSER=0/,
      },
    },
    canary: zeroBy('observed:error'),
    canarySaw: { error: /^c\.capture\(\) is refused: REEVAL_CAPTURE_BROWSER=0/ },
    record: ({ run }) => {
      assert.equal(landed(run)?.files.artifacts, undefined)
    },
  },
  {
    dir: 'ui/capture-no-download',
    tiers: ['fake', 'docker'],
    env: 'plain',
    hostEnv: (dir) => ({ XDG_CACHE_HOME: join(dir, '.cache') }),
    canary: zeroBy('observed:missing.txt'),
    canarySaw: { 'missing.txt': null },
    record: ({ project }) => {
      const cache = join(project, '.cache', 'reeval')
      assert.equal(existsSync(join(cache, 'chrome-headless-shell')), false)
    },
  },
  {
    dir: 'ui/capture-wait-idle',
    tiers: ['fake', 'docker'],
    env: 'ui',
    canary: zeroBy('observed:home'),
    canarySaw: { home: { path: 'artifacts/home.png' } },
    record: ({ run, runDir, tier }) => {
      const art = landed(run)?.files.artifacts?.[0]
      assert.ok(art, 'files.artifacts names the PNG')
      assert.match(art.path, /artifacts\/home\.png$/)
      const bytes = readFileSync(join(runDir, art.path))
      const viewport = art.capture?.viewport ?? { width: 1280, height: 720 }
      const port = art.capture?.port ?? 0
      if (tier === 'fake') {
        assert.deepEqual(bytes, stubPng('home', port, '/', viewport))
      } else {
        assert.deepEqual(pngSize(bytes), viewport)
      }
    },
  },
  {
    // Docker only: the fake sandbox stubs the PNG and never waits on CDP.
    dir: 'ui/capture-wait-timeout',
    tiers: ['docker'],
    env: 'ui',
    lands: {
      outcome: 'fail',
      error: {
        kind: 'assertion',
        message:
          /c\.capture\(\) timed out on loading the page with wait: "idle": it used all of its 5s timeout/,
      },
    },
    canary: zeroBy('observed:error'),
    canarySaw: { error: /^c\.capture\(\) timed out on loading the / },
    record: ({ run }) => {
      assert.equal(landed(run)?.files.artifacts, undefined)
    },
  },
  {
    dir: 'ui/capture-use',
    tiers: ['fake'],
    env: 'ui',
    canary: zeroBy('observed:after-submit'),
    canarySaw: { 'after-submit': { path: 'artifacts/after-submit.png' } },
    record: ({ run, runDir }) => {
      const art = landed(run)?.files.artifacts?.[0]
      assert.ok(art, 'files.artifacts names the PNG')
      assert.match(art.path, /artifacts\/after-submit\.png$/)
      assert.deepEqual(art.capture?.instructions, ['Fill in the sign-in form and submit'])
      const bytes = readFileSync(join(runDir, art.path))
      const viewport = art.capture?.viewport ?? { width: 1280, height: 720 }
      const port = art.capture?.port ?? 0
      assert.deepEqual(bytes, stubPng('after-submit', port, '/', viewport))
    },
  },
  {
    dir: 'ui/capture-use-judge',
    tiers: ['fake'],
    env: 'ui',
    args: ['--profile', 'vision'],
    // The plan checks the judge's key; the fake sandbox drives no journey, so it's never sent.
    hostEnv: { GOOGLE_GENERATIVE_AI_API_KEY: 'fixture-key' },
    canary: zeroBy('observed:journey'),
    canarySaw: { journey: { path: 'artifacts/journey.png' } },
    record: ({ run }) => {
      const art = landed(run)?.files.artifacts?.[0]
      assert.ok(art, 'files.artifacts names the PNG')
      assert.deepEqual(art.capture?.use, { model: 'google/gemini-3.8-flash', moves: 0 })
    },
  },
  {
    dir: 'ui/capture-full-page',
    tiers: ['fake', 'docker'],
    env: 'ui',
    canary: zeroBy('observed:tall'),
    canarySaw: { tall: { viewport: 'full-page' } },
    record: ({ run, runDir, tier }) => {
      const art = landed(run)?.files.artifacts?.[0]
      assert.ok(art, 'files.artifacts names the PNG')
      assert.equal(art.capture?.fullPage, true)
      assert.deepEqual(art.capture?.viewport, { width: 1280, height: 720 })
      const bytes = readFileSync(join(runDir, art.path))
      const port = art.capture?.port ?? 0
      if (tier === 'fake') {
        assert.deepEqual(bytes, stubPng('tall', port, '/', 'full-page'))
      } else {
        assert.ok(pngSize(bytes).height > 720)
      }
    },
  },
  {
    dir: 'ui/capture-use-click',
    tiers: ['docker'],
    env: 'ui',
    canary: zeroBy('observed:state'),
    canarySaw: { state: 'no' },
    record: ({ run }) => {
      const art = landed(run)?.files.artifacts?.[0]
      assert.ok(art)
      assert.equal(art.capture?.use?.model, 'fake')
      assert.ok((art.capture?.use?.moves ?? 0) >= 1)
    },
  },
  {
    dir: 'ui/capture-sandbox-loopback',
    tiers: ['docker', 'podman'],
    env: 'ui',
    hostEnv: egressEnv,
    canary: zeroBy('observed:state'),
    canarySaw: { state: '' },
    record: ({ run }) => {
      const [api, page] = landed(run)?.serves ?? []
      assert.equal(api?.port, 9099)
      assert.equal(landed(run)?.files.artifacts?.[0]?.capture?.port, page?.port)
    },
  },
  {
    dir: 'ui/capture-use-wait',
    tiers: ['docker'],
    env: 'ui',
    canary: zeroBy('observed:state'),
    canarySaw: { state: 'no' },
    record: ({ run }) => {
      assert.deepEqual(landed(run)?.files.artifacts?.[0]?.capture?.instructions, [
        'fake[0]',
        'fake[1]',
      ])
    },
  },
  {
    dir: 'ui/capture-use-history',
    tiers: ['docker'],
    env: 'ui',
    hostEnv: () => ({ ANTHROPIC_API_KEY: 'fixture-key', ANTHROPIC_BASE_URL: scriptedVision.url }),
    canary: zeroBy('observed:state'),
    canarySaw: { state: 'ada@example.com' },
    record: ({ run }) => {
      const art = landed(run)?.files.artifacts?.[0]
      assert.deepEqual(art?.capture?.use, { model: 'anthropic/scripted-vision', moves: 5 })
      assert.ok(
        scriptedVision.prompts.some((p) =>
          /^5\. click \{"x":200,"y":215\} on button "Sign up" → now at \/welcome(;|$)/m.test(p),
        ),
        'the model saw its submit move take the page to /welcome',
      )
    },
  },
  {
    dir: 'ui/capture-use-stuck',
    tiers: ['docker'],
    env: 'ui',
    hostEnv: () => ({ ANTHROPIC_API_KEY: 'fixture-key', ANTHROPIC_BASE_URL: scriptedVision.url }),
    lands: {
      outcome: 'fail',
      error: {
        kind: 'assertion',
        message:
          /c\.capture\(\) instruction 1 of 1 "Open the menu" repeated click \{"x":600,"y":600\} on the page background 5 times and nothing changed/,
      },
    },
    canary: zeroBy('observed:error'),
    canarySaw: { error: /^c\.capture\(\) instruction 1 of 1 "Open / },
    record: () => {
      assert.ok(
        scriptedVision.prompts.some((p) =>
          p.includes('Your last moves repeated the same action and nothing changed.'),
        ),
        'the model was nudged before the capture stopped',
      )
    },
  },
  {
    dir: 'ui/capture-use-timeout',
    tiers: ['docker'],
    env: 'ui',
    lands: {
      outcome: 'fail',
      error: {
        kind: 'assertion',
        message:
          /c\.capture\(\) timed out on "fake\[0\]" \(instruction 1 of 1, after 1 move\): it used all of its 10s timeout\. Raise timeout on the call or capture\.timeout\./,
      },
    },
    canary: zeroBy('observed:error'),
    canarySaw: { error: /^c\.capture\(\) timed out on "fake\[0\]"/ },
    record: ({ run, runDir }) => {
      const [step, ...rest] = landed(run)?.files.artifacts ?? []
      assert.equal(rest.length, 0, 'no PNG of the capture itself')
      assert.equal(step?.name, 'late.step-1')
      assert.deepEqual(step?.capture?.step && { ...step.capture.step, ms: 0 }, {
        of: 'late',
        index: 1,
        instruction: 'fake[0]',
        moves: 1,
        ms: 0,
        ended: 'stopped',
      })
      assert.ok(pngSize(readFileSync(join(runDir, step.path))).width > 0)
      assert.match(
        landed(run)?.error?.message ?? '',
        /The page as it stopped: artifacts\/late\.step-1\.png\.$/,
      )
    },
  },
  {
    dir: 'ui/capture-use-scroll',
    tiers: ['docker'],
    env: 'ui',
    canary: zeroBy('observed:state'),
    canarySaw: { state: 'no' },
    record: ({ run }) => {
      const art = landed(run)?.files.artifacts?.[0]
      assert.deepEqual(art?.capture?.use, { model: 'fake', moves: 2 })
    },
  },
  {
    dir: 'ui/capture-use-final',
    tiers: ['docker'],
    env: 'ui',
    canary: zeroBy('observed:state'),
    canarySaw: { state: 'no' },
    record: ({ run, runDir }) => {
      const [capture, step] = landed(run)?.files.artifacts ?? []
      assert.deepEqual(capture?.capture?.use, { model: 'fake', moves: 1 })
      assert.equal(step?.name, 'after.step-1')
      assert.equal(step?.capture?.step?.ended, 'final')
      assert.ok(pngSize(readFileSync(join(runDir, step.path))).width > 0)
    },
  },
  {
    dir: 'run/define-eval',
    tiers: ['fake'],
    env: 'fake',
    canary: zeroBy('observed:api'),
    canarySaw: { api: 'define-eval' },
    evals: {
      lands: { outcome: 'pass', attempts: ['fake/-/fake#1'] },
      canary: {
        outcome: 'fail',
        attempts: ['fake/-/fake#1'],
        error: { kind: 'assertion', message: zeroBy('observed:api') },
      },
    },
  },
  {
    dir: 'run/cases',
    tiers: ['fake'],
    env: 'cases',
    canary: zeroBy('word'),
    canarySaw: { word: 'ahoy' },
    evals: {
      lands: { outcome: 'pass', attempts: ['fake/cases/fake#ahoy#1'] },
      canary: {
        outcome: 'fail',
        attempts: ['fake/cases/fake#hello#1'],
        error: { kind: 'assertion', message: zeroBy('word') },
      },
    },
    record: ({ run }) => {
      const lands = run.evals.find((e) => e.name === 'lands')
      assert.deepEqual(
        lands?.cases?.map((k) => [k.key, k.outcome, k.verdict]),
        [['ahoy', 'pass', undefined]],
        'the case is a row inside its eval',
      )
      assert.equal(lands?.caseCount, 1)
      assert.equal(lands?.family, undefined)
      assert.equal(run.families, undefined, 'the record has no families')
    },
  },
  {
    dir: 'run/cases-rate',
    tiers: ['fake'],
    env: 'rate',
    canary: zeroBy('passes-its-case', 0.7),
    evals: Object.fromEntries(
      (['lands', 'canary'] as const).map((name) => [
        name,
        {
          outcome: name === 'lands' ? ('pass' as const) : ('fail' as const),
          attempts: ['a', 'b', 'c'].map((key) => `fake/rate/fake#${key}#1`),
          error: {
            kind: 'assertion' as const,
            message: zeroBy('passes-its-case', name === 'lands' ? 0.6 : 0.7),
          },
          clean: ['fake/rate/fake#a#1', 'fake/rate/fake#b#1'],
        },
      ]),
    ),
    record: ({ run, runDir, stdout }) => {
      const rates = (name: string) =>
        run.evals
          .find((e) => e.name === name)
          ?.cells.map((c) => [c.rate?.rate, c.rate?.passRate, c.rate?.outcome])
      for (const e of run.evals)
        assert.deepEqual(
          e.cases?.map((k) => [k.key, k.outcome, k.verdict]),
          [
            ['a', 'pass', 'family'],
            ['b', 'pass', 'family'],
            ['c', 'fail', 'family'],
          ],
          'each case keeps its own outcome, and the rate over them decides',
        )
      assert.match(
        stdout,
        /^Done in \S+ · 2 evals · 1 on target · 1 below$/m,
        'the tally counts each eval with cases once',
      )
      assert.match(
        stdout,
        /✗ canary {2}67% < 70% {2}metric\(0\.7\)\n +#c {2}0% {2}passes-its-case 0%\n/,
      )
      assert.deepEqual(rates('lands'), [[0.667, 0.6, 'pass']], 'the rate over the cases clears 0.6')
      assert.deepEqual(rates('canary'), [[0.667, 0.7, 'fail']], 'and is below 0.7')
      const summary = readFileSync(join(runDir, 'summary.md'), 'utf8')
      assert.match(
        summary,
        /^\| \[canary\]\(#canary\) \| .* \| 67% < 70% · metric\(0\.7\) \|/m,
        "the summary's row headlines the rate against its target",
      )
      assert.match(summary, /^## lands\n[\s\S]*?^\*\*67% ≥ 60%\*\* · metric\(0\.6\)$/m)
      for (const [name, below] of [
        ['canary', '0\\.7'],
        ['lands', '0\\.6'],
      ])
        assert.match(
          summary,
          new RegExp(
            `^## ${name}\\n[\\s\\S]*?\\| score 0\\.00 below ${below}: passes-its-case scored 0\\.00 \\| n/a \\| 1 of 3 \\|`,
            'm',
          ),
          'the failed case is in its eval',
        )
    },
  },
  {
    dir: 'run/trait',
    tiers: ['fake'],
    env: 'next-app',
    args: ['--trait', 'stack=next'],
    canary: zeroBy('observed:stack'),
    canarySaw: { stack: 'vite' },
    evals: {
      lands: { outcome: 'pass', attempts: ['fake/next-app/fake#1'] },
      canary: {
        outcome: 'fail',
        attempts: ['fake/next-app/fake#1', 'fake/vite-app/fake#1'],
        error: { kind: 'assertion', message: zeroBy('observed:stack') },
        clean: ['fake/next-app/fake#1'],
      },
    },
    record: ({ run }) => {
      const lands = run.evals.find((e) => e.name === 'lands')
      assert.deepEqual(
        lands?.cells.map((c) => c.environment),
        ['next-app'],
        'vite-app is left out',
      )
      assert.deepEqual(run.invocation?.traits, ['stack=next'], '--resume plans with it again')
    },
  },
  {
    dir: 'run/where',
    tiers: ['fake'],
    env: 'next-app',
    canary: zeroBy('runs-on-its-own-stack'),
    canarySaw: { stack: 'next' },
    evals: {
      lands: {
        outcome: 'pass',
        attempts: ['fake/next-app/fake#next#1', 'fake/vite-app/fake#vite#1'],
      },
      canary: {
        outcome: 'fail',
        attempts: [
          'fake/next-app/fake#next#1',
          'fake/next-app/fake#vite#1',
          'fake/vite-app/fake#vite#1',
        ],
        error: { kind: 'assertion', message: zeroBy('runs-on-its-own-stack') },
        clean: ['fake/next-app/fake#next#1', 'fake/vite-app/fake#vite#1'],
      },
    },
    record: ({ run }) => {
      const lands = run.evals.find((e) => e.name === 'lands')
      const own = (e: typeof lands, key: string) => e?.cases?.find((k) => k.key === key)
      assert.deepEqual(
        own(lands, 'next')?.excluded,
        [{ case: 'next', environment: 'vite-app' }],
        'its own pairs',
      )
      assert.deepEqual(own(lands, 'vite')?.excluded, [{ case: 'vite', environment: 'next-app' }])
      assert.deepEqual(
        own(lands, 'next')?.cells.map((c) => [c.environment, c.traits]),
        [['next-app', { stack: 'next' }]],
      )
      const canary = run.evals.find((e) => e.name === 'canary')
      assert.deepEqual(own(canary, 'next')?.excluded, [{ case: 'next', environment: 'vite-app' }])
      assert.deepEqual(
        [lands?.caseCount, lands?.cases?.length, lands?.excluded],
        [
          3,
          2,
          [
            { case: 'next', environment: 'vite-app' },
            { case: 'vite', environment: 'next-app' },
            { case: 'astro', environment: 'next-app' },
            { case: 'astro', environment: 'vite-app' },
          ],
        ],
        'a case where leaves out everywhere stays in the eval',
      )
    },
  },
  {
    dir: 'run/traits-hidden',
    tiers: ['fake'],
    env: 'hidden',
    canaryEnv: 'leaked',
    canary: zeroBy('observed:trait-found'),
    canarySaw: { 'trait-found': /leak\.txt/ },
    record: ({ run }) => {
      const lands = run.evals.find((e) => e.name === 'lands')
      assert.deepEqual(
        lands?.cells[0]?.traits,
        { stack: 'next', marker: 'trait-zx81', auth: ['clerk', 'none'] },
        'the cell records the merged traits',
      )
    },
  },
  {
    dir: 'run/target-metric',
    tiers: ['fake'],
    env: 'observe',
    lands: { outcome: 'pass', error: { kind: 'assertion', message: zeroBy('observed:pick') } },
    landsPass: [],
    canary: zeroBy('observed:pick'),
    canarySaw: { pick: 'sqlite' },
    record: ({ run, stdout }) => {
      const lands = run.evals.find((e) => e.name === 'lands')
      assert.deepEqual(
        [lands?.target, lands?.cells.map((c) => c.gate)],
        [{ kind: 'metric' }, ['none']],
        'target: metric() records its cells ungated',
      )
      assert.match(stdout, /^└─ · lands {2}0% {2}metric\(\)$/m)
      assert.match(stdout, /^Done in \S+ · 2 evals · 1 below · 1 report only$/m)
    },
  },
  {
    dir: 'run/target-regression',
    tiers: ['fake'],
    env: 'plain',
    canary: /^score 0\.75 below 0\.8: half scored 0\.50$/,
    record: ({ run }) => {
      const lands = run.evals.find((e) => e.name === 'lands')
      assert.equal(lands?.attempts[0]?.score, 0.75)
      assert.deepEqual(lands?.target, { kind: 'regression', threshold: 0.7 })
      assert.deepEqual(lands?.scores, { meanScore: 0.75, passAtK: 1, passHatK: 1 })
      const canary = run.evals.find((e) => e.name === 'canary')
      assert.deepEqual(canary?.scores, { meanScore: 0.75, passAtK: 0, passHatK: 0 })
    },
  },
  {
    dir: 'run/target-capability',
    tiers: ['fake'],
    env: '-',
    canary: zeroBy('observed:attempt'),
    canarySaw: { attempt: 1 },
    evals: {
      lands: {
        outcome: 'pass',
        attempts: ['fake/-/fake#1', 'fake/-/fake#2'],
        error: { kind: 'assertion', message: zeroBy('observed:attempt') },
        clean: ['fake/-/fake#2'],
      },
      canary: {
        outcome: 'fail',
        attempts: ['fake/-/fake#1', 'fake/-/fake#2'],
        error: { kind: 'assertion', message: zeroBy('observed:attempt') },
      },
    },
    record: ({ run }) => {
      const lands = run.evals.find((e) => e.name === 'lands')
      assert.deepEqual(
        [lands?.cells[0]?.gate, lands?.scores],
        ['any', { meanScore: 0.5, passAtK: 1, passHatK: 0 }],
        'one passing attempt of two is pass@k',
      )
    },
  },
  {
    dir: 'run/snapshots',
    tiers: ['fake', 'docker'],
    env: 'snapshots',
    canary: zeroBy('built.js'),
    canaryGraded: { 'built.js': 'export const built = true\n' },
    record: ({ run, project }) => {
      const at = (path: string | null | undefined) =>
        join(project, '.reeval', 'runs', run.runId, ...(path ?? '').split('/'))
      const kept = landed(run)
      const [final, ...more] = kept?.snapshots ?? []
      assert.equal(more.length, 0, 'lands took only its final snapshot')
      assert.equal(final?.name, 'final')
      assert.equal(final?.form, 'dir')
      assert.equal(final?.skipped, null)
      assert.deepEqual(final?.excluded, ['node_modules/'])
      assert.equal(
        readFileSync(join(at(final?.path), 'app', 'built.js'), 'utf8'),
        'export const built = true\n',
      )
      assert.equal(existsSync(join(at(final?.path), 'node_modules')), false)
      const canary = run.evals.find((e) => e.name === 'canary')?.attempts[0]
      assert.equal(canary?.snapshots, undefined, 'snapshot: false takes none')
    },
  },
  {
    dir: 'run/snapshot-turns',
    tiers: ['fake', 'docker'],
    env: 'snapshot-turns',
    canary: zeroBy('built.js'),
    canaryGraded: { 'built.js': 'export const built = true\n' },
    record: ({ run, project }) => {
      const at = (path: string | null | undefined) =>
        join(project, '.reeval', 'runs', run.runId, ...(path ?? '').split('/'))
      const names = (name: string) =>
        (run.evals.find((e) => e.name === name)?.attempts[0]?.snapshots ?? []).map((s) => [
          s.name,
          s.form,
          s.path?.split('/').at(-1),
        ])
      assert.deepEqual(names('lands'), [
        ['turn-1', 'tar.gz', 'turn-1.tar.gz'],
        ['final', 'tar.gz', 'final.tar.gz'],
      ])
      const turn = landed(run)?.snapshots?.[0]
      const files = readTar(gunzipSync(readFileSync(at(turn?.path))))
        .filter((e) => e.type === 'file')
        .map((e) => e.path)
        .sort()
      assert.deepEqual(files, ['app/built.js', 'app/start.js'])
      assert.deepEqual(
        names('canary'),
        [
          ['turn-1', 'dir', 'turn-1'],
          ['final', 'dir', 'final'],
        ],
        "'turns' alone takes directories",
      )
    },
  },
  {
    dir: 'run/files-changed',
    tiers: ['fake', 'docker'],
    env: 'notes',
    args: ['-v'],
    canary: zeroBy('observed:diff-files'),
    record: ({ run, stdout }) => {
      const attempt = landed(run)
      assert.equal(attempt?.activity.fileEdits, 0, 'the shell write is no edit tool call')
      assert.deepEqual(
        attempt?.changedFiles.map((f) => f.path),
        ['note.txt', 'setup.txt'],
      )
      const turn = stdout.split('\n').find((l) => l.includes('lands') && /turn 1 done/.test(l))
      assert.match(
        turn ?? '',
        /· 1 tool call, 1 file changed$/,
        "the eval's own write isn't the turn's",
      )
    },
  },
  {
    dir: 'run/cost',
    tiers: ['fake'],
    env: '-',
    prepare: seedModelsDev,
    hostEnv: (dir) => ({ XDG_CACHE_HOME: join(dir, '.cache'), REEVAL_PRICES: '' }),
    canary: zeroBy('tokens'),
    evals: {
      lands: {
        outcome: 'pass',
        attempts: ['reporter/-/fake#1', 'listed/-/fake#1', 'unknown/-/fake#1'],
      },
      canary: {
        outcome: 'fail',
        attempts: ['silent/-/fake#1'],
        error: { kind: 'assertion', message: zeroBy('tokens') },
        clean: [],
      },
    },
    record: ({ run, stdout }) => {
      const lands = run.evals.find((e) => e.name === 'lands')
      const of = (id: string) => lands?.attempts.find((a) => a.id.startsWith(`${id}/`))
      const reported = { usd: 0.25, basis: 'reported', source: 'fake' }
      assert.deepEqual(of('reporter')?.turns[0]?.cost, reported, "the harness's cost wins")
      assert.deepEqual(of('reporter')?.cost, reported)
      const today = new Date().toISOString().slice(0, 10)
      // 1,000 in at $2, 2,000 cache reads at $0.20 and 500 out at $10 per million.
      const estimated = { usd: 0.0074, basis: 'estimated', source: `models.dev ${today}` }
      assert.deepEqual(of('listed')?.turns[0]?.cost, estimated, 'priced at the served model')
      assert.deepEqual(of('listed')?.cost, estimated)
      assert.equal(
        of('unknown')?.turns[0]?.cost,
        undefined,
        'an unlisted model costs nothing known',
      )
      assert.equal(of('unknown')?.cost, undefined)
      assert.deepEqual(run.cost.agentUsd, {
        usd: 0.2574,
        basis: 'estimated',
        source: `fake, models.dev ${today}`,
        unpriced: 1,
      })
      assert.equal(run.cost.judgeUsd, undefined)
      assert.match(stdout, /^Done in .* · \$0\.26 \(est\., 1 unpriced\)$/m)
    },
  },
  {
    dir: 'run/best-of',
    tiers: ['fake'],
    env: 'best-of',
    canary: zeroBy('observed:word'),
    canarySaw: { word: 'ahoy' },
    evals: {
      lands: {
        outcome: 'pass',
        attempts: ['fake/best-of/fake#1', 'fake/best-of/fake#2', 'fake/best-of/fake#3'],
        error: { kind: 'assertion', message: zeroBy('observed:word') },
        clean: ['fake/best-of/fake#1', 'fake/best-of/fake#3'],
      },
      canary: {
        outcome: 'fail',
        attempts: ['fake/best-of/fake#1', 'fake/best-of/fake#2', 'fake/best-of/fake#3'],
        error: { kind: 'assertion', message: zeroBy('observed:word') },
        clean: ['fake/best-of/fake#3'],
      },
    },
    record: ({ run, stdout }) => {
      const marks = (name: string) =>
        run.evals
          .find((e) => e.name === name)
          ?.attempts.map((a) => [a.n, a.outcome, a.bestOf ?? null])
      assert.deepEqual(marks('lands'), [
        [1, 'pass', null],
        [2, 'fail', null],
        [3, 'pass', 'added'],
      ])
      assert.deepEqual(marks('canary'), [
        [1, 'fail', null],
        [2, 'fail', null],
        [3, 'skipped', 'skipped'],
      ])
      for (const cell of run.evals.flatMap((e) => e.cells)) {
        assert.equal(cell.bestOf, 3)
        assert.deepEqual(cell.gate, { passRate: 0.5 })
      }
      assert.match(
        entryOf(stdout, 'canary'),
        /✗ canary {2}0\/2 runs at 100% \(best of 3\) {2}regression\(1\)$/m,
      )
      assert.match(
        entryOf(stdout, 'lands'),
        /✓ lands {2}2\/3 runs at 100% \(best of 3\) {2}regression\(1\)$/m,
      )
    },
  },
  {
    dir: 'output/none',
    tiers: ['fake'],
    env: '-',
    canary: /second try\n\n1 !== 2/,
    record: ({ stdout }) => {
      assert.equal(entryOf(stdout, 'lands').trim(), '✓ lands  1/1 run at 100%  regression(1)')
      assert.equal(
        entryOf(stdout, 'canary'),
        [
          '✗ canary  0/1 run at 100%  regression(1)',
          '  #1  0%  second try 1 !== 2',
          '    before the first turn',
          '    at task (evals/canary.eval.ts:7:21)',
        ].join('\n'),
      )
      assert.match(stdout, /\nDone in \S+ · 2 evals · 1 on target · 1 below\n/)
    },
  },
  {
    dir: 'output/events',
    tiers: ['fake'],
    env: '-',
    canary: zeroBy('observed:attempt'),
    canarySaw: { attempt: 1 },
    args: ['--events-file', 'out/events.ndjson'],
    async record({ run, project, stdout }) {
      const file = join(project, 'out', 'events.ndjson')
      const lines = readFileSync(file, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as { type: string; [k: string]: unknown })
      assert.deepEqual(
        [lines[0]?.type, lines[0]?.schemaVersion, lines[0]?.runId],
        ['header', 1, run.runId],
      )
      assert.deepEqual(lines.at(-1)?.type === 'exit' && lines.at(-1)?.code, 1)
      assert.ok(lines.some((l) => l.type === 'log' && l.text === 'streamed from lands\n'))
      assert.equal(lines.filter((l) => l.type === 'eval-end').length, 2)
      const attached = await runCli(project, ['attach', 'out/events.ndjson'])
      assert.equal(attached.code, 1, "attach exits with the run's code")
      assert.equal(attached.stdout, stdout, 'attach prints what the run printed')
    },
  },
  {
    dir: 'output/study',
    tiers: ['fake'],
    env: 'marked',
    cells: ['plain', 'marked'],
    lands: {
      outcome: 'pass',
      error: { kind: 'assertion', message: zeroBy('has-file:marker.txt') },
    },
    landsPass: [],
    canary: zeroBy('has-file:marker.txt'),
    args: ['--json'],
    async record({ project, runDir, stdout }) {
      const suite = JSON.parse(stdout) as SuiteResult
      assert.deepEqual(
        {
          onTarget: suite.tally.onTarget,
          reportOnly: suite.tally.reportOnly,
          below: suite.tally.below,
        },
        { onTarget: 0, reportOnly: 1, below: 1 },
      )
      const summary = readFileSync(join(runDir, 'summary.md'), 'utf8')
      assert.match(summary, /\| \[lands\]\(#lands\) \| ab;[\s\S]*marked vs plain/)
      assert.match(summary, /^## lands$/m)
      assert.match(summary, /### Baseline vs\. variants/)
      assert.doesNotMatch(summary, /\b100% pass rate\b/)
      const recorded = await runCli(project, ['record'])
      assert.equal(recorded.code, 0, recorded.stdout + recorded.stderr)
      const compared = await runCli(project, ['compare'])
      assert.match(compared.stdout, /^2 new evals \(1 below · 1 report only\)$/m)
      const history = await runCli(project, ['history'])
      assert.match(history.stdout, /^ {2}○ +– {2}lands$/m)
    },
  },
  {
    dir: 'output/change',
    tiers: ['fake'],
    env: 'marked',
    cells: ['plain', 'marked'],
    lands: {
      outcome: 'pass',
      error: { kind: 'assertion', message: zeroBy('has-file:marker.txt') },
    },
    landsPass: ['marked'],
    canary: zeroBy('has-file:marker.txt'),
    record: ({ stdout }) => {
      assert.match(
        entryOf(stdout, 'lands'),
        /✓ lands {2}1\/1 run at 100% {2}regression\(1\)\n +arm +pass\n +plain +0 of 1\n +error {2}score 0\.00 below 1: has-file:marker\.txt scored 0\.00\n +marked +1 of 1 {2}helped\n/,
      )
      assert.match(
        entryOf(stdout, 'lands'),
        /\n +Worth knowing: 1 run per side; set runs: 4 at evals\/lands\.eval\.ts to confirm this difference\.$/,
      )
      assert.match(entryOf(stdout, 'canary'), /^ +marked +0 of 1 {2}same$/m)
      assert.doesNotMatch(
        stdout.replaceAll(' at 100%', '').replace(/^ +#\S+ {2}\d+% .*$/gm, ''),
        /%|pass@1/,
        'only an attempt row reads a score',
      )
    },
  },
  {
    dir: 'output/harness',
    tiers: ['fake'],
    env: '-',
    canary: zeroBy('has-file:out.txt'),
    evals: {
      lands: { outcome: 'pass', attempts: ['writer/-/fake#1', 'copier/-/fake#1'] },
      canary: {
        outcome: 'fail',
        attempts: ['writer/-/fake#1', 'idler/-/fake#1'],
        error: { kind: 'assertion', message: zeroBy('has-file:out.txt') },
        clean: ['writer/-/fake#1'],
      },
    },
    record: ({ stdout }) => {
      assert.equal(entryOf(stdout, 'lands').trim(), '✓ lands  2/2 runs at 100%  regression(1)')
      assert.match(
        entryOf(stdout, 'canary'),
        /✗ canary {2}1\/2 runs at 100%, worst 0% {2}regression\(1\)\n +idler {2}0% {2}has-file:out\.txt 0%$/,
      )
    },
  },
  {
    dir: 'output/both',
    tiers: ['fake'],
    env: 'marked',
    canary: zeroBy('has-file:marker.txt'),
    evals: {
      lands: {
        outcome: 'pass',
        attempts: [
          'writer/plain/fake#1',
          'writer/marked/fake#1',
          'copier/plain/fake#1',
          'copier/marked/fake#1',
        ],
        error: { kind: 'assertion', message: zeroBy('has-file:marker.txt') },
        clean: ['writer/marked/fake#1', 'copier/marked/fake#1'],
      },
      canary: {
        outcome: 'fail',
        attempts: [
          'writer/plain/fake#1',
          'writer/marked/fake#1',
          'copier/plain/fake#1',
          'copier/marked/fake#1',
        ],
        error: { kind: 'assertion', message: zeroBy('has-file:marker.txt') },
      },
    },
    record: ({ stdout }) => {
      const lands = entryOf(stdout, 'lands')
      assert.match(
        lands,
        /✓ lands {2}2\/2 runs at 100% {2}regression\(1\)\n {2}writer\n +arm +pass\n +plain +0 of 1\n +error {2}score 0\.00 below 1: has-file:marker\.txt scored 0\.00\n +marked +1 of 1 {2}helped\n/,
      )
      assert.match(
        lands,
        /\n {2}copier\n +arm +pass\n +plain +0 of 1\n +error {2}score 0\.00 below 1: has-file:marker\.txt scored 0\.00\n +marked +1 of 1 {2}helped\n/,
      )
      assert.match(
        lands,
        /\n +Worth knowing: 1 run per side; set runs: 4 at evals\/lands\.eval\.ts to confirm these differences\.$/,
      )
    },
  },
  {
    dir: 'output/cases',
    tiers: ['fake'],
    env: '-',
    canary: /is red\n\n'green' !== 'red'/,
    evals: {
      lands: { outcome: 'pass', attempts: ['fake/-/fake#red#1', 'fake/-/fake#blue#1'] },
      canary: {
        outcome: 'fail',
        attempts: ['fake/-/fake#red#1', 'fake/-/fake#green#1'],
        error: { kind: 'assertion', message: /is red\n\n'green' !== 'red'/ },
        clean: ['fake/-/fake#red#1'],
      },
    },
    record: ({ stdout }) => {
      assert.match(stdout, /✓ lands {2}2\/2 runs at 100% {2}regression\(1\)\n\n/)
      assert.match(
        stdout,
        /✗ canary {2}1\/2 runs at 100%, worst 0% {2}regression\(1\)\n +#green {2}0% {2}is red 'green' !== 'red'\n +before the first turn\n +at task \(evals\/canary\.eval\.ts:8:21\)/,
      )
      assert.match(stdout, /\nDone in \S+ · 2 evals · 1 on target · 1 below\n/)
    },
  },
  {
    dir: 'output/infra-error',
    tiers: ['fake'],
    env: 'missing',
    canaryEnv: '-',
    lands: {
      outcome: 'infra_error',
      error: { kind: 'infra', message: /^setup step 1\/1 "touch ran" in environment missing/ },
    },
    canary: zeroBy('observed:attempt'),
    canarySaw: { attempt: 1 },
    record: ({ stdout }) => {
      assert.match(
        entryOf(stdout, 'lands'),
        /· lands {2}infra error {2}regression\(1\)\n +#1 {2}infra error {2}setup step 1\/1 "touch ran"/,
      )
      assert.match(stdout, /\nDone in \S+ · 2 evals · 1 below · 1 infra error\n/)
    },
  },
  {
    dir: 'output/run-error',
    tiers: ['fake'],
    env: '-',
    canary: zeroBy('observed:attempt'),
    canarySaw: { attempt: 1 },
    args: ['--json'],
    record: ({ run, runDir, stdout }) => {
      const message = 'stray rejection outside the evals'
      assert.deepEqual(run.errors, [message])
      const suite = JSON.parse(stdout) as SuiteResult
      assert.equal(suite.outcome, 'fail', 'the outcome the exit code is read from')
      assert.deepEqual(suite.errors, [message])
      assert.equal(suite.tally.errors, 1)
      const summary = readFileSync(join(runDir, 'summary.md'), 'utf8')
      assert.match(summary, /^## lands$/m)
      assert.match(summary, /^## canary$/m)
      assert.match(summary, /^## Attempt index$/m)
      assert.doesNotMatch(summary, /\[object Object\]/)
    },
  },
  {
    dir: 'python-sdk/hello',
    tiers: ['fake', 'docker', 'real'],
    env: '-',
    canary: /missing-greet\.py exists/,
    args: ['--output-logs', 'errors-only'],
    prepare: (dir) => syncPythonFixtureProject(dir),
    record: ({ run, stdout }) => {
      const [lands] = run.evals.find((e) => e.name === 'lands')?.attempts ?? []
      assert.equal(lands?.outcome, 'pass', 'the plain asserts in a Python body hold')
      const [canary] = run.evals.find((e) => e.name === 'canary')?.attempts ?? []
      assert.equal(
        canary?.failure?.reason,
        'missing-greet.py exists',
        "a Python body's failed assert is its attempt's failure",
      )
      assert.deepEqual(
        canary?.checks.map((c) => c.command),
        ['test -f missing-greet.py'],
        'the command the assert reads runs once',
      )
      assert.match(
        stdout,
        /canary#1[^\n]*stdout \| looking for missing-greet\.py/,
        "a Python body's print is its attempt's output",
      )
    },
  },
  {
    dir: 'python-sdk/attempt-isolation',
    tiers: ['fake'],
    env: '-',
    args: ['--concurrency', '1'],
    canary: /zombie\.txt exists/,
    evals: {
      lands: { outcome: 'pass', attempts: ['fake/-/fake#1'] },
      canary: {
        outcome: 'fail',
        attempts: ['fake/-/fake#1'],
        error: { kind: 'assertion', message: /zombie\.txt exists/ },
      },
      'times out': {
        outcome: 'fail',
        attempts: ['fake/-/fake#1'],
        error: { kind: 'timeout', message: /timed out/ },
      },
    },
    prepare: (dir) => syncPythonFixtureProject(dir),
    record: ({ run }) => {
      const [lands] = run.evals.find((e) => e.name === 'lands')?.attempts ?? []
      assert.deepEqual(
        lands?.checks.map((c) => c.command),
        ['test ! -f zombie.txt'],
        "a timed-out body's late call doesn't run in the next attempt on its cell",
      )
      const [timedOut] = run.evals.find((e) => e.name === 'times out')?.attempts ?? []
      assert.deepEqual(timedOut?.checks, [], 'nor in its own, which reeval already ended')
    },
  },
  {
    dir: 'python-sdk/caught-asserts',
    tiers: ['fake'],
    env: '-',
    canary: /missing file/,
    evals: {
      'assert retries': { outcome: 'pass', attempts: ['fake/-/fake#1'] },
      canary: {
        outcome: 'fail',
        attempts: ['fake/-/fake#1'],
        error: { kind: 'assertion', message: /^missing file$/ },
      },
    },
    prepare: (dir) => syncPythonFixtureProject(dir),
    record: ({ run }) => {
      const [retries] = run.evals.find((e) => e.name === 'assert retries')?.attempts ?? []
      assert.deepEqual(
        retries?.checks.map((c) => [c.command, c.exitCode]),
        [
          ['test -f ready.txt', 1],
          ['touch ready.txt', 0],
          ['test -f ready.txt', 0],
        ],
        'a plain assert the body catches fails nothing, and the loop tries again',
      )
    },
  },
  {
    dir: 'python-sdk/declared-skip',
    tiers: ['fake'],
    env: '-',
    canary: /ran: 'ran' is not 'skipped'/,
    evals: {
      lands: { outcome: 'pass', attempts: ['fake/-/fake#1'] },
      canary: {
        outcome: 'fail',
        attempts: ['fake/-/fake#1'],
        error: { kind: 'assertion', message: /ran: 'ran' is not 'skipped'/ },
      },
      parked: { outcome: 'skipped', attempts: ['fake/-/fake#1'] },
      shelved: { outcome: 'skipped', attempts: ['fake/-/fake#1'] },
    },
    prepare: (dir) => syncPythonFixtureProject(dir),
    record: ({ run, stdout }) => {
      assert.deepEqual(
        run.evals.map((e) => [e.name, e.skip ?? false, e.todo]).sort(),
        [
          ['canary', false, false],
          ['lands', false, false],
          ['parked', true, false],
          ['shelved', true, false],
        ],
        'an eval declared skipped, or in a skipped group, is marked skip; one that ran is not',
      )
      assert.match(stdout, /– parked +skipped$/m, 'a complete run shows a declared skip as skipped')
    },
  },
  {
    dir: 'run/resume',
    tiers: ['fake'],
    env: 'resume',
    args: ['--resume'],
    canary: zeroBy('observed:marker.txt'),
    canarySaw: { 'marker.txt': 'resume' },
    prepare: (dir) => writeStoppedStaging(dir, SEEDED_RUN_ID),
    record: ({ run, project }) => {
      assert.equal(run.runId, SEEDED_RUN_ID)
      assert.equal(readFileSync(join(project, '.reeval/current'), 'utf8').trim(), SEEDED_RUN_ID)
    },
  },
  {
    dir: 'run/retry-errors',
    tiers: ['fake'],
    env: 'retry',
    args: ['--retry-errors'],
    canary: zeroBy('observed:marker.txt'),
    canarySaw: { 'marker.txt': 'retry' },
    prepare: async (dir) => {
      const r = await runCli(dir, ['run'], {
        env: { REEVAL_FIXTURE_OUTAGE: '1', REEVAL_FIXTURE_SANDBOX: 'fake' },
      })
      assert.equal(r.code, 3, r.stdout + r.stderr)
    },
    record: ({ run, project, stdout }) => {
      assert.equal(
        readdirSync(join(project, '.reeval/runs')).filter((n) => n.endsWith('.json')).length,
        1,
      )
      for (const a of run.evals.flatMap((e) => e.attempts)) {
        assert.deepEqual(
          a.retries?.map((r) => r.error),
          [{ kind: 'infra', message: 'fixture outage before the first turn' }],
        )
      }
      assert.match(stdout, /^retried 2 errored attempts: 1 now passes, 1 fails, 0 still error$/m)
    },
  },
]

/** Paths under `dir` whose content includes `needle`, one per line; '' when none do. */
function filesContaining(dir: string, needle: string): string {
  try {
    return execFileSync('grep', ['-rlF', needle, dir], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

/** Paths under `dir` named `name`. */
function filesNamed(dir: string, name: string): string[] {
  return execFileSync('find', [dir, '-name', name], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
}

/** The container CLI a tier runs on. */
const cliOf = (tier: Tier) => (tier === 'podman' ? 'podman' : 'docker')
const imageBuilt = (ref: string, cli = 'docker') => {
  try {
    execFileSync(cli, ['image', 'inspect', ref], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
const dockerReady = imageBuilt(DEFAULT_IMAGE)
const requireDocker = process.env.REEVAL_TEST_REQUIRE_DOCKER === '1'
const podmanReady = imageBuilt(DEFAULT_IMAGE, 'podman')
const requirePodman = process.env.REEVAL_TEST_REQUIRE_PODMAN === '1'
/** Real Cursor, for the attempt ledger (support/harnesses.ts). */
const cursorRow = harnesses.find((h) => h.id === 'cursor') as (typeof harnesses)[number]
/** The contract row a fixture's real tier runs on: Cursor, or its `realHarness`. */
const realRowOf = (f: Feature) =>
  f.realHarness ? (harnesses.find((h) => h.id === f.realHarness) as HarnessRow) : cursorRow
/** Cursor's is REEVAL_REAL_MODEL's (default composer-2.5); another row's is its contract model. */
const realModelOf = (row: HarnessRow) => (row === cursorRow ? realModel : (row.model ?? ''))
/** The real tier runs only when asked, since it spends money; asked, it needs the key. */
const real = process.env.REEVAL_TEST_REAL === '1'
const realModel = process.env.REEVAL_REAL_MODEL ?? 'composer-2.5'
/** `REEVAL_FIXTURE_TIERS=docker` (or `fake`) runs one tier only. */
const only = process.env.REEVAL_FIXTURE_TIERS?.split(',')

/** Containers are removed by a detached `docker rm`, which may finish after the CLI exits. */
async function containersGone(runId: string, cli: string, deadlineMs = 20_000): Promise<void> {
  const until = Date.now() + deadlineMs
  let left = ''
  do {
    left = execFileSync(
      cli,
      ['ps', '-a', '--filter', `label=${LABEL.run}=${runId}`, '--format', '{{.Names}} {{.State}}'],
      { encoding: 'utf8' },
    ).trim()
    if (!left) return
    await new Promise((r) => setTimeout(r, 250))
  } while (Date.now() < until)
  assert.equal(left, '', `containers of run ${runId} still exist after ${deadlineMs / 1000}s`)
}

/**
 * Force-removes the containers of every run the fixture's project started, finished or not: the
 * sweep after a stopped run, in case its SIGTERM teardown was cut short by the SIGKILL.
 */
function removeProjectContainers(project: string, cli: string): void {
  const runIds = ['staging', 'runs'].flatMap((d) => {
    const dir = join(project, '.reeval', d)
    return existsSync(dir) ? readdirSync(dir).map((f) => f.replace(/\.json$/, '')) : []
  })
  for (const runId of new Set(runIds)) {
    const ids = execFileSync(cli, ['ps', '-aq', '--filter', `label=${LABEL.run}=${runId}`], {
      encoding: 'utf8',
    })
      .split(/\s+/)
      .filter(Boolean)
    if (ids.length) execFileSync(cli, ['rm', '-f', ...ids], { stdio: 'ignore' })
  }
}

/** Each attempt's debug.log, as lines. */
function debugLogs(project: string): string[][] {
  const root = join(project, '.reeval', 'debug')
  if (!existsSync(root)) return []
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('debug.log'))
    .map((f) => readFileSync(join(root, f), 'utf8').trimEnd().split('\n'))
}

/** The end of each attempt's debug.log, which says where a stopped run was stuck. */
function attemptTrails(project: string): string {
  const root = join(project, '.reeval', 'debug')
  if (!existsSync(root)) return ''
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('debug.log'))
    .sort()
    .map((f) => {
      const lines = readFileSync(join(root, f), 'utf8').trimEnd().split('\n')
      return `\n--- .reeval/debug/${f}, last ${Math.min(lines.length, 20)} lines:\n${lines.slice(-20).join('\n')}`
    })
    .join('')
}

/** A fixture's run is stopped this long before its test's timeout: the grace, and a margin. */
const FIXTURE_STOP_MS = { fake: 10_000, docker: 30_000, podman: 30_000, real: 30_000 } as const
const FIXTURE_GRACE_MS = { fake: 5_000, docker: 20_000, podman: 20_000, real: 20_000 } as const

function skipTier(
  tier: Tier,
  image?: BakedHarness,
  posixModes?: true,
  hostDevice?: string,
): string | false {
  if (only && !only.includes(tier)) return `REEVAL_FIXTURE_TIERS=${only.join(',')}`
  if (hostDevice && !existsSync(hostDevice)) return `needs ${hostDevice} on the host`
  if (tier === 'fake' && posixModes && process.platform === 'win32')
    return 'Windows has no executable bit'
  if (tier === 'real')
    return real ? false : 'set REEVAL_TEST_REAL=1 (and CURSOR_API_KEY) for real Cursor'
  if (tier === 'docker' && !requireDocker) {
    if (!dockerReady) return `needs Docker and ${DEFAULT_IMAGE}`
    if (image && !imageBuilt(imageFor(image))) return `needs ${imageFor(image)}`
  }
  if (tier === 'podman' && !requirePodman) {
    if (!podmanReady) return `needs Podman and ${DEFAULT_IMAGE} (reeval image build with podman())`
    if (image && !imageBuilt(imageFor(image), 'podman')) return `needs ${imageFor(image)} in Podman`
  }
  return false
}

// Windows CI runs four fake fixtures at once on a slower runner: a typical one takes 20s
// there, and the slowest reach 60s.
const FAKE_TIMEOUT_MS = process.platform === 'win32' ? 150_000 : 60_000

function fixtureTests(tiers: Tier[], pick: (f: Feature) => boolean = () => true) {
  for (const f of features.filter(pick)) {
    for (const tier of f.tiers.filter((t) => tiers.includes(t))) {
      const timeout =
        f.timeoutMs?.[tier] ??
        { fake: FAKE_TIMEOUT_MS, docker: 240_000, podman: 240_000, real: 600_000 }[tier]
      test(`${rowName(f)} [${tier}]`, {
        skip: skipTier(tier, f.image, f.posixModes, f.hostDevice),
        // The run's own deadline starts once it holds the loopback, which it may wait for.
        timeout: timeout + (f.loopback ? LOOPBACK_WAIT_MS : 0),
      }, async (t) => {
        const row = realRowOf(f)
        if (tier === 'real') {
          reserveAttempts(row, 2, `fixture ${rowName(f)}`)
        }
        if (f.loopback) {
          const release = await holdLoopback()
          t.after(release)
        }
        const p = await fixture(`features/${f.dir}`)
        await f.prepare?.(p.dir)
        const cwd = join(p.dir, f.cwd ?? '')
        const r = await runCli(
          cwd,
          ['run', ...(tier === 'real' ? ['--concurrency', '1'] : []), ...(f.args ?? [])],
          {
            env: {
              ...(typeof f.hostEnv === 'function' ? f.hostEnv(p.dir) : f.hostEnv),
              REEVAL_FIXTURE_SANDBOX: tier === 'real' ? 'docker' : tier,
              ...(f.layout ? { REEVAL_FIXTURE_LAYOUT: f.layout } : {}),
              ...(tier === 'real'
                ? {
                    REEVAL_FIXTURE_HARNESS: harnessOf(row),
                    REEVAL_REAL_MODEL: realModelOf(row),
                    ...(row.key ? { [row.key.name]: keyOf(row) } : {}),
                  }
                : {}),
            },
            timeoutMs: timeout - FIXTURE_STOP_MS[tier],
            // Stopped inside the test's timeout, so the failure has the run's output and the run
            // has canceled, and removed its containers, before the next test starts.
            deadlineMs: timeout - FIXTURE_STOP_MS[tier],
            graceMs: FIXTURE_GRACE_MS[tier],
            signal: t.signal,
          },
        ).catch((error: Error) => {
          if (tier !== 'fake') removeProjectContainers(p.dir, cliOf(tier))
          error.message += attemptTrails(p.dir)
          throw error
        })
        const sandbox = f.sandbox ?? (tier === 'real' ? 'docker' : tier)
        const harness =
          tier === 'real' ? `${harnessOf(row)}:${realModelOf(row).split('/').at(-1)}` : 'fake'
        const ids = (names: string[]) => names.map((env) => `${harness}/${env}/${sandbox}#1`)
        const { run, dir: runDir } = readRun(p.dir)
        expectRun(r, run, {
          code: 1,
          evals: f.evals ?? {
            lands: {
              outcome: 'pass',
              ...f.lands,
              attempts: ids(f.cells ?? [f.env]),
              ...(f.landsPass ? { clean: ids(f.landsPass) } : {}),
            },
            canary: {
              outcome: 'fail',
              attempts: ids(f.canaryCells ?? f.cells ?? [f.canaryEnv ?? f.env]),
              error: {
                kind: 'assertion',
                message: typeof f.canary === 'function' ? f.canary(tier) : f.canary,
              },
              ...(f.canaryPass ? { clean: ids(f.canaryPass) } : {}),
            },
          },
        })
        const failed = canaryAttempt(run)
        for (const [name, want] of Object.entries(f.canarySaw ?? {})) {
          const saw = failed?.observations?.find((o) => o.name === name)?.value
          sawMatches(saw, want, `the canary's ${name}`)
        }
        for (const [name, want] of Object.entries(
          (typeof f.canaryGraded === 'function' ? f.canaryGraded(tier) : f.canaryGraded) ?? {},
        )) {
          const grade = failed?.grades?.find((g) => g.grader === name)?.grade
          sawMatches(grade, want, `the canary's ${name} grade`)
        }
        await f.record?.({ run, project: p.dir, runDir, tier, stdout: r.stdout })
        assert.deepEqual(liveSandboxes(p), [], 'every sandbox is removed')
        if (tier !== 'fake') await containersGone(run.runId, cliOf(tier))
      })
    }
  }
}

describe('feature fixtures', { concurrency: 4 }, () =>
  fixtureTests(['fake', 'docker', 'podman'], (f) => !f.loopback),
)
// One at a time: they share one loopback lock, so concurrent rows would only queue on it with
// their timeouts running.
describe('feature fixtures on the loopback', { concurrency: 1 }, () =>
  fixtureTests(['fake', 'docker', 'podman'], (f) => !!f.loopback),
)
// Real attempts run one at a time, each within its own timeout.
describe('feature fixtures on real Cursor', { concurrency: 1 }, () => fixtureTests(['real']))

test("cloud(): a recipe that doesn't build fails its attempts as config, building once and keeping the VM", {
  skip: skipTier('docker'),
  timeout: 240_000,
}, async () => {
  buildSshVmImage(['boat', 'boat-docker'])
  const p = await project('cloud-recipe-fails', {
    'reeval.config.ts': `
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { cloud } from 'reeval/internal/vm'
export default defineConfig({
  agents: fakeAgent({ script: [[{ exec: 'true' }]] }),
  sandbox: cloud({ install: ['echo no such package >&2; exit 7'], reuse: true }),
  runs: 2,
  concurrency: 1,
})
`,
    'evals/a.eval.ts': `
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('hi')
  },
})
`,
  })
  const r = await runCli(p.dir, ['run'], {
    env: { REEVAL_VM_URL: vmService.url, REEVAL_VM_TOKEN: vmService.token },
    timeoutMs: 210_000,
  })
  assert.equal(r.code, 3, r.stdout + r.stderr)
  const { run } = readRun(p.dir)
  const attempts = run.evals.flatMap((e) => e.attempts)
  assert.equal(attempts.length, 2)
  for (const a of attempts) {
    assert.equal(a.error?.prepare?.class, 'config', JSON.stringify(a.error))
    assert.equal(a.error?.prepare?.stage, 'install')
    assert.match(String(a.error?.message), /^cloud VM bx_\w+ couldn't prepare the sandbox image: /)
  }
  const builds = debugLogs(p.dir).filter((log) => log.some((l) => /Installing 1 command/.test(l)))
  assert.equal(builds.length, 1, 'the second attempt fails without building again')
  const prefix = runPrefix(CLOUD_VM, run.runId)
  const creates = dockerBoatApi.requests.filter(
    (q) => q.call === 'POST /sandboxes' && String(q.body?.name).startsWith(prefix),
  )
  assert.equal(creates.length, 1, "the recipe's failure doesn't take the VM out of the pool")
  assert.deepEqual(
    dockerBoatApi.live().filter((name) => name.startsWith(prefix)),
    [],
    'every VM of the run is deleted',
  )
})

test('every feature fixture is in the table, with one check and a canary', () => {
  const root = join(testDir, 'features')
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((group) =>
      readdirSync(join(root, group.name), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => `${group.name}/${d.name}`),
    )
    .sort()
  assert.deepEqual(dirs, [...new Set(features.map((f) => f.dir))].sort())
  const names = features.map(rowName)
  assert.deepEqual(names, [...new Set(names)], 'every row has its own name')
  assert.deepEqual(
    [...BAKED_HARNESSES],
    TART_HARNESSES,
    'every harness has a tart-brokered-agent row',
  )
  for (const dir of dirs) {
    const evals = readdirSync(join(root, dir, 'evals')).filter((f) => /\.eval\.(ts|py)$/.test(f))
    const ext = evals.some((f) => f.endsWith('.eval.py')) ? '.eval.py' : '.eval.ts'
    assert.deepEqual(evals.sort(), [`canary${ext}`, `lands${ext}`].sort(), dir)
    assert.ok(existsSync(join(root, dir, 'reeval.config.ts')), dir)
  }
})
