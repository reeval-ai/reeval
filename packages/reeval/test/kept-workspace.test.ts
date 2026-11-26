// The kept workspace: what it keeps and leaves out, its manifest, its caps, the run's cap at
// assembly, and reading it back with an attempt's other trajectory through `readTrajectory`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { gunzipSync, gzipSync } from 'node:zlib'
import { readTar, writeTar } from '@reeval/sandbox-docker'
import type { Attempt } from '../src/attempt/state.ts'
import { keepWorkspace } from '../src/attempt/workspace.ts'
import { snapshot } from '../src/diff.ts'
import { Artifacts, placeWorkspace } from '../src/history/assemble.ts'
import { readKeptFiles, readRef, readTrajectory } from '../src/history/trajectory.ts'
import type { AttemptFiles, AttemptRecord, ExecLine } from '../src/history/types.ts'
import { sha256 } from '../src/ids.ts'
import type { Sandbox } from '../src/sandbox/index.ts'
import type { EvalRecord } from '../src/types.ts'
import { fakeConfig, project, runCli, tempDir } from './helpers.ts'
import { dockerRunning } from './support/minio.ts'

const SECRET = `ghp_${'a1B2'.repeat(9)}`

/** A sandbox on the host: its workspace is `<dir>/work`, its state `<dir>/state`. */
function hostBox(dir: string): Sandbox {
  mkdirSync(join(dir, 'work'), { recursive: true })
  mkdirSync(join(dir, 'state'), { recursive: true })
  return {
    workdir: join(dir, 'work'),
    stateDir: join(dir, 'state'),
    execOwn: async (command: string) => {
      try {
        const stdout = execFileSync('/bin/sh', ['-c', command], {
          cwd: join(dir, 'state'),
          encoding: 'utf8',
          maxBuffer: 1 << 26,
        })
        return { exitCode: 0, stdout, stderr: '' }
      } catch (error) {
        const e = error as { status?: number; stdout?: string; stderr?: string }
        return { exitCode: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' }
      }
    },
  } as unknown as Sandbox
}

const attemptFor = (signal = new AbortController().signal) =>
  ({ signal, record: {} }) as unknown as Attempt & { record: EvalRecord }

const write = (dir: string, path: string, data: string | Buffer) => {
  mkdirSync(join(dir, path, '..'), { recursive: true })
  writeFileSync(join(dir, path), data)
}

describe('keepWorkspace', {
  skip: process.platform === 'win32' && 'runs the archive commands in sh, which Windows lacks',
}, () => {
  test('keeps what git does not ignore, masked, with a manifest of hashes', async () => {
    const dir = tempDir('keep-workspace')
    const box = hostBox(dir)
    const work = box.workdir
    write(work, 'package.json', '{}\n')
    await snapshot(box)
    write(work, '.gitignore', 'dist/\n')
    write(work, 'src/app.js', 'export {}\n')
    write(work, 'dist/bundle.js', 'built\n')
    write(work, 'node_modules/dep/index.js', 'dep\n')
    write(work, 'pkg/.venv/lib.py', 'x\n')
    write(work, '.env', `GITHUB_TOKEN=${SECRET}\n`)
    write(work, 'bin/run.sh', '#!/bin/sh\necho hi\n')
    chmodSync(join(work, 'bin/run.sh'), 0o755)
    symlinkSync('src/app.js', join(work, 'link'))
    const a = attemptFor()
    await keepWorkspace(a, box, join(dir, 'kept'))
    const { sha256: archiveHash, ...kept } = a.record.workspace ?? {}
    const archive = readFileSync(join(dir, 'kept/workspace.tar.gz'))
    assert.deepEqual(kept, {
      files: 6,
      bytes: archive.length,
      excluded: ['node_modules/', 'pkg/.venv/'],
      masked: ['.env'],
      dropped: [],
      skipped: null,
    })
    assert.equal(archiveHash, sha256(archive))
    const entries = readTar(gunzipSync(archive))
    const manifest = JSON.parse(readFileSync(join(dir, 'kept/workspace.json'), 'utf8'))
    assert.deepEqual(
      manifest.files.map((f: { path: string }) => f.path),
      ['.env', '.gitignore', 'bin/run.sh', 'link', 'package.json', 'src/app.js'],
      'dist/ is ignored, and the dependency directories are left out by name',
    )
    for (const f of manifest.files) {
      const e = entries.find((x) => x.path === f.path)
      if (e?.type === 'file') assert.equal(f.sha256, sha256(e.data), f.path)
    }
    const run = manifest.files.find((f: { path: string }) => f.path === 'bin/run.sh')
    assert.equal(run.executable, true)
    const link = manifest.files.find((f: { path: string }) => f.path === 'link')
    assert.equal(link.target, 'src/app.js')
    const env = entries.find((e) => e.path === '.env')
    assert.ok(env?.type === 'file' && !env.data.toString().includes(SECRET))
    assert.ok(!existsSync(join(box.stateDir, 'kept.tar.gz')), 'nothing left in the sandbox')
  })

  test('drops a file the scan finds a secret in that masking cannot reach, naming it', async () => {
    const dir = tempDir('keep-workspace-secrets')
    const box = hostBox(dir)
    await snapshot(box)
    write(box.workdir, 'notes-utf16.txt', Buffer.from(`token ${SECRET}\n`, 'utf16le'))
    write(box.workdir, 'blob.bin', Buffer.concat([Buffer.from([0, 1, 2, 0]), Buffer.from(SECRET)]))
    write(box.workdir, `${SECRET}.txt`, 'named\n')
    write(box.workdir, 'ok.txt', 'fine\n')
    const a = attemptFor()
    await keepWorkspace(a, box, join(dir, 'kept'))
    assert.deepEqual(
      [...(a.record.workspace?.dropped ?? [])].sort(),
      ['[REDACTED].txt', 'blob.bin', 'notes-utf16.txt'],
      'the UTF-16 and binary files, and the file whose name is the token, its name masked',
    )
    const archive = readFileSync(join(dir, 'kept/workspace.tar.gz'))
    const raw = gunzipSync(archive)
    assert.deepEqual(
      readTar(raw).map((e) => e.path),
      ['ok.txt'],
    )
    assert.ok(!raw.includes(SECRET) && !raw.includes(Buffer.from(SECRET, 'utf16le')))
    assert.ok(!JSON.stringify(a.record.workspace).includes(SECRET))
  })

  test('keeps none over its cap, saying why', async () => {
    const dir = tempDir('keep-workspace-cap')
    const box = hostBox(dir)
    await snapshot(box)
    const random = Buffer.alloc(64 * 1024)
    for (let i = 0; i < random.length; i++) random[i] = Math.floor(Math.random() * 256)
    write(box.workdir, 'random.bin', random)
    const over = attemptFor()
    await keepWorkspace(over, box, join(dir, 'kept'), { tar: 16 * 1024, raw: 2 ** 20 })
    assert.equal(over.record.workspace?.skipped?.cause, 'size')
    assert.match(
      over.record.workspace?.skipped?.message ?? '',
      /^the workspace is \d+(\.\d+)? KB compressed without its ignored, dependency and cache files, over the 16\.0 KB cap$/,
    )
    assert.equal(over.record.workspace?.bytes, 0)
    assert.ok(!existsSync(join(dir, 'kept')))
    const raw = attemptFor()
    await keepWorkspace(raw, box, join(dir, 'kept'), { tar: 2 ** 20, raw: 16 * 1024 })
    assert.match(
      raw.record.workspace?.skipped?.message ?? '',
      /over 16\.0 KB uncompressed without .+, the most reeval masks$/,
    )
  })

  test('keeps the workspace on an Alpine image, where every tool but git is BusyBox', async (t) => {
    if (!(await dockerRunning())) {
      if (process.env.REEVAL_TEST_REQUIRE_DOCKER === '1') throw new Error('Docker is not running')
      t.skip('needs Docker')
      return
    }
    const ctr = execFileSync(
      'docker',
      [
        'run',
        '-d',
        '--rm',
        'alpine:3',
        'sh',
        '-c',
        'apk add --no-cache git >/dev/null && mkdir -p /work /state && touch /ready && sleep 600',
      ],
      { encoding: 'utf8' },
    ).trim()
    try {
      const sh = (command: string, cwd = '/state') => {
        try {
          const stdout = execFileSync('docker', ['exec', '-w', cwd, ctr, 'sh', '-c', command], {
            encoding: 'utf8',
            maxBuffer: 1 << 26,
          })
          return { exitCode: 0, stdout, stderr: '' }
        } catch (error) {
          const e = error as { status?: number; stdout?: string; stderr?: string }
          return { exitCode: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' }
        }
      }
      for (let i = 0; sh('test -f /ready', '/').exitCode !== 0; i++) {
        if (i > 120) throw new Error('git never installed in the Alpine container')
        await new Promise((r) => setTimeout(r, 500))
      }
      const box = {
        workdir: '/work',
        stateDir: '/state',
        execOwn: async (command: string) => sh(command),
      } as unknown as Sandbox
      await snapshot(box)
      sh(
        "mkdir -p src node_modules/dep bin && echo 'export {}' > src/app.js && echo dep > node_modules/dep/index.js && printf '#!/bin/sh\\n' > bin/run.sh && chmod +x bin/run.sh && ln -s src/app.js app",
        '/work',
      )
      const dir = tempDir('keep-workspace-alpine')
      const a = attemptFor()
      await keepWorkspace(a, box, join(dir, 'kept'))
      assert.equal(a.record.workspace?.skipped, null, a.record.workspace?.skipped?.message)
      assert.deepEqual(a.record.workspace?.excluded, ['node_modules/'])
      const manifest = JSON.parse(readFileSync(join(dir, 'kept/workspace.json'), 'utf8'))
      assert.deepEqual(
        manifest.files.map((f: { path: string; executable?: true; target?: string }) => [
          f.path,
          f.executable ?? f.target ?? null,
        ]),
        [
          ['app', 'src/app.js'],
          ['bin/run.sh', true],
          ['src/app.js', null],
        ],
      )
      assert.equal(sh('test -e /state/kept.tar.gz').exitCode, 1, 'nothing left in the sandbox')
    } finally {
      execFileSync('docker', ['rm', '-f', ctr], { stdio: 'ignore' })
    }
  })

  test('a workspace without the git index keeps none, saying so; a stopped attempt nothing', async () => {
    const dir = tempDir('keep-workspace-error')
    const box = hostBox(dir)
    const a = attemptFor()
    await keepWorkspace(a, box, join(dir, 'kept'))
    assert.equal(a.record.workspace?.skipped?.cause, 'error')
    const stop = new AbortController()
    stop.abort()
    const stopped = attemptFor(stop.signal)
    await keepWorkspace(stopped, box, join(dir, 'kept'))
    assert.equal(stopped.record.workspace, undefined)
  })
})

describe('placeWorkspace', () => {
  test('moves the archive into the run, and keeps none past the run cap', async () => {
    const dir = tempDir('place-workspace')
    const staged = join(dir, 'evals/a.json')
    write(dir, 'evals/a.workspace/workspace.tar.gz', 'archive')
    write(dir, 'evals/a.workspace/workspace.json', '{"schemaVersion":1,"files":[]}\n')
    const kept = {
      files: 0,
      bytes: 7,
      excluded: [],
      masked: [],
      dropped: [],
      skipped: null,
      sha256: sha256('archive'),
    }
    const out = new Artifacts()
    const files: AttemptFiles = {}
    const gone = await placeWorkspace(kept, 'e/c/0', out, join(dir, 'evals/b.json'), {}, 10)
    assert.deepEqual(gone.skipped, {
      cause: 'error',
      message: "its archive was gone from the run's staging folder",
    })
    const placed = await placeWorkspace(kept, 'e/c/1', out, staged, files, 10)
    assert.equal(placed?.skipped, null)
    assert.deepEqual(files.workspace, {
      path: 'e/c/1/workspace.tar.gz',
      sha256: kept.sha256,
      bytes: 7,
    })
    assert.equal(files.workspaceManifest?.path, 'e/c/1/workspace.json')
    assert.equal(
      out.moves.get('e/c/1/workspace.tar.gz'),
      join(dir, 'evals/a.workspace/workspace.tar.gz'),
    )
    const second: AttemptFiles = {}
    const past = await placeWorkspace(kept, 'e/c/2', out, staged, second, 10)
    assert.deepEqual(past?.skipped, {
      cause: 'size',
      message: "the run's kept workspaces passed 10 B",
    })
    assert.deepEqual(second, {})
  })
})

describe('readTrajectory', () => {
  test("reads an attempt's execs, observations, captures and kept files, checking each hash", async () => {
    const run = tempDir('trajectory')
    const ref = (path: string, data: string | Buffer) => {
      write(run, path, data)
      const bytes = Buffer.from(data)
      return { path, sha256: sha256(bytes), bytes: bytes.length }
    }
    const lines: ExecLine[] = [
      {
        command: 'npm test',
        label: 'tests',
        exitCode: 0,
        stdout: 'ok\n',
        stderr: '',
        durationMs: 5,
        turn: 1,
      },
    ]
    const box = hostBox(tempDir('trajectory-box'))
    await snapshot(box)
    write(box.workdir, 'src/app.js', 'export {}\n')
    const a = attemptFor()
    await keepWorkspace(a, box, join(run, 'staged'))
    const attempt = {
      observations: [{ name: 'orm', value: 'drizzle', turn: 1, sha256: sha256('"drizzle"') }],
      files: {
        execs: ref('1/execs.jsonl', lines.map((l) => `${JSON.stringify(l)}\n`).join('')),
        workspace: ref('1/workspace.tar.gz', readFileSync(join(run, 'staged/workspace.tar.gz'))),
        workspaceManifest: ref(
          '1/workspace.json',
          readFileSync(join(run, 'staged/workspace.json'), 'utf8'),
        ),
        artifacts: [
          { ...ref('1/artifacts/home.png', 'png'), name: 'home', mediaType: 'image/png' },
        ],
      },
    } as unknown as AttemptRecord
    const t = await readTrajectory(run, attempt)
    assert.deepEqual(t.execs, lines)
    assert.deepEqual(t.observations, attempt.observations)
    assert.equal((await t.readArtifact('home'))?.toString(), 'png')
    assert.equal(await t.readArtifact('missing'), null)
    assert.deepEqual(
      t.workspace?.manifest.files.map((f) => f.path),
      ['src/app.js'],
    )
    assert.equal((await t.workspace?.readFile('src/app.js'))?.toString(), 'export {}\n')
    assert.equal(await t.workspace?.readFile('nope.js'), null)
    writeFileSync(join(run, '1/execs.jsonl'), 'changed\n')
    await assert.rejects(
      readTrajectory(run, attempt),
      /1\/execs\.jsonl changed since the run wrote it/,
    )
    const bare = await readTrajectory(run, { files: {} } as unknown as AttemptRecord)
    assert.deepEqual([bare.execs, bare.observations, bare.workspace], [[], [], null])
  })

  test('reads a large observed value from its file', async () => {
    const run = tempDir('trajectory-observed')
    const value = { rows: ['x'.repeat(5000)] }
    const json = JSON.stringify(value)
    write(run, '1/observations/1.json', json)
    const file = { path: '1/observations/1.json', sha256: sha256(json), bytes: json.length }
    const attempt = {
      observations: [{ name: 'rows', value: null, turn: 1, sha256: file.sha256, file }],
      files: {},
    } as unknown as AttemptRecord
    const t = await readTrajectory(run, attempt)
    assert.deepEqual(t.observations[0]?.value, value)
  })

  test('refuses a ref that climbs out of the run or is absolute', async () => {
    const run = tempDir('trajectory-refs')
    for (const path of ['../outside.txt', '/etc/passwd', '1/../../x', 'a//b']) {
      await assert.rejects(
        readRef(run, { path, sha256: sha256(''), bytes: 0 }),
        /isn't a path inside the run/,
        path,
      )
    }
  })

  test('follows symbolic links inside the workspace only, and fetches a missing archive', async () => {
    const box = hostBox(tempDir('trajectory-links-box'))
    await snapshot(box)
    write(box.workdir, 'src/app.js', 'export {}\n')
    symlinkSync('src/app.js', join(box.workdir, 'app'))
    symlinkSync('src', join(box.workdir, 'lib'))
    symlinkSync('../outside', join(box.workdir, 'out'))
    symlinkSync('/etc/passwd', join(box.workdir, 'abs'))
    symlinkSync('loop', join(box.workdir, 'loop'))
    const run = tempDir('trajectory-links')
    const a = attemptFor()
    await keepWorkspace(a, box, join(run, 'staged'))
    const archive = readFileSync(join(run, 'staged/workspace.tar.gz'))
    const manifest = readFileSync(join(run, 'staged/workspace.json'))
    write(run, '1/workspace.json', manifest)
    const workspace = { path: '1/workspace.tar.gz', sha256: sha256(archive), bytes: archive.length }
    const attempt = {
      files: {
        workspace,
        workspaceManifest: {
          path: '1/workspace.json',
          sha256: sha256(manifest),
          bytes: manifest.length,
        },
      },
    } as unknown as AttemptRecord
    const fetched: string[] = []
    const kept = await readKeptFiles(run, attempt, {
      fetch: async (ref, file) => {
        fetched.push(ref.path)
        writeFileSync(file, archive)
      },
    })
    assert.equal((await kept?.readFile('app'))?.toString(), 'export {}\n')
    assert.equal((await kept?.readFile('lib/app.js'))?.toString(), 'export {}\n')
    assert.deepEqual(fetched, ['1/workspace.tar.gz'], 'fetched once, then read from the run')
    assert.ok(existsSync(join(run, '1/workspace.tar.gz')))
    for (const path of ['out', 'abs', 'loop', 'src', 'lib']) {
      assert.equal(await kept?.readFile(path), null, path)
    }
    const bad = await readKeptFiles(tempDir('trajectory-bad-fetch'), {
      files: { ...attempt.files, workspaceManifest: attempt.files.workspaceManifest },
    } as unknown as AttemptRecord).catch((error: Error) => error)
    assert.ok(bad instanceof Error, 'no manifest in that run')
    const wrong = tempDir('trajectory-wrong-fetch')
    write(wrong, '1/workspace.json', manifest)
    const refetched = await readKeptFiles(wrong, attempt, {
      fetch: async (_ref, file) => writeFileSync(file, 'not it'),
    })
    await assert.rejects(
      refetched?.readFile('app') ?? Promise.resolve(),
      /changed since the run wrote it/,
    )
    assert.ok(!existsSync(join(wrong, '1/workspace.tar.gz')), 'a wrong download is not kept')
  })
})

describe('recording a kept workspace', () => {
  test('scans each file in the archive as it streams, and refuses a run with a secret in one', async () => {
    const p = await project('record-kept-workspace', {
      'reeval.config.ts': fakeConfig({
        harness: "{ script: [[{ write: { 'src/app.js': 'export {}\\n' } }]] }",
        extra: "record: 'manual',",
      }),
      'evals/a.eval.ts':
        "import { defineEval } from 'reeval'\nexport default defineEval({ async task(c) { await c.send('go') } })\n",
    })
    const ran = await runCli(p.dir, ['run'])
    assert.equal(ran.code, 0, ran.stdout + ran.stderr)
    const runs = join(p.dir, '.reeval/runs')
    const runId = (readdirSync(runs).find((f) => f.endsWith('.json')) ?? '').replace(/\.json$/, '')
    const record = JSON.parse(readFileSync(join(runs, `${runId}.json`), 'utf8'))
    const ref = record.evals[0].attempts[0].files.workspace
    assert.ok(ref, 'the attempt kept its workspace')
    const leak = gzipSync(
      writeTar([
        { type: 'file', path: 'leak.bin', mode: 0o644, mtime: 0, data: Buffer.from(`\0${SECRET}`) },
      ]),
    )
    writeFileSync(join(runs, runId, ...ref.path.split('/')), leak)
    Object.assign(ref, { sha256: sha256(leak), bytes: leak.length })
    writeFileSync(join(runs, `${runId}.json`), JSON.stringify(record))
    const refused = await runCli(p.dir, ['record', runId])
    assert.equal(refused.code, 2, refused.stdout + refused.stderr)
    assert.match(
      refused.stderr + refused.stdout,
      new RegExp(
        `Refusing to record ${runId}: .*\\n.*${ref.path.replace(/[.]/g, '\\.')}: leak\\.bin`,
      ),
    )
    assert.ok(!(refused.stderr + refused.stdout).includes(SECRET))
    const skipped = await runCli(p.dir, ['record', '--skip-secret-scan', runId])
    assert.equal(skipped.code, 0, skipped.stdout + skipped.stderr)
    const history = join(p.dir, 'evals/.history', runId, ...ref.path.split('/'))
    assert.equal(sha256(readFileSync(history)), sha256(leak), 'copied into the history by path')
  })
})
