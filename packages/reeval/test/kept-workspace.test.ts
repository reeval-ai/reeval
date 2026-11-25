// The kept workspace: what it keeps and leaves out, its manifest, its caps, the run's cap at
// assembly, and reading it back with an attempt's other trajectory through `readTrajectory`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { gunzipSync } from 'node:zlib'
import { readTar } from '@reeval/sandbox-docker'
import type { Attempt } from '../src/attempt/state.ts'
import { keepWorkspace } from '../src/attempt/workspace.ts'
import { snapshot } from '../src/diff.ts'
import { Artifacts, placeWorkspace } from '../src/history/assemble.ts'
import { readTrajectory } from '../src/history/trajectory.ts'
import type { AttemptFiles, AttemptRecord, ExecLine } from '../src/history/types.ts'
import { sha256 } from '../src/ids.ts'
import type { Sandbox } from '../src/sandbox/index.ts'
import type { EvalRecord } from '../src/types.ts'
import { tempDir } from './helpers.ts'

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
    assert.match(raw.record.workspace?.skipped?.message ?? '', /over 16\.0 KB without .+, the most/)
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
})
