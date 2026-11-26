// Graders: their definition and refusals, the context they read an attempt through, their grades
// and scores, the attempt's score, their code digests, and running them on an attempt end to end.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { writeTar } from '@reeval/sandbox-docker'
import type { GradeInputs } from '../src/grade/context.ts'
import { defineGrader, defineGraders, type GraderDef, graderDef } from '../src/grade/define.ts'
import { functionDigest } from '../src/grade/digest.ts'
import { attemptScore, runGraders, scoreFailure } from '../src/grade/run.ts'
import { graderSlots, type SandboxStarter } from '../src/grade/sandbox.ts'
import type { Grader } from '../src/grade/types.ts'
import { keptFiles } from '../src/history/trajectory.ts'
import { sha256 } from '../src/ids.ts'
import { registerSecret } from '../src/redact.ts'
import { createSandbox, InfraError } from '../src/sandbox/index.ts'
import { docker, fakeSandbox, tart } from '../src/sandbox.ts'
import { acquire } from '../src/scheduler/client.ts'
import type { GradeRecord } from '../src/types.ts'
import { fakeConfig, project, readRun, runCli, tempDir } from './helpers.ts'

const SECRET = `ghp_${'a1B2'.repeat(9)}`

function inputs(files: Record<string, string> = {}): GradeInputs {
  const entries = Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))
  const manifest = {
    schemaVersion: 1 as const,
    files: entries.map(([path, text]) => ({
      path,
      sha256: sha256(Buffer.from(text)),
      bytes: text.length,
    })),
  }
  const archive = gzipSync(
    writeTar(
      entries.map(([path, text]) => ({
        type: 'file' as const,
        path,
        mode: 0o644,
        mtime: 0,
        data: Buffer.from(text),
      })),
    ),
  )
  const png = Buffer.from('png')
  return {
    case: { key: 'iso', input: 'PT1H' } as GradeInputs['case'],
    turns: [],
    trajectory: {
      execs: [
        {
          command: 'npm test',
          label: 'tests',
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
          durationMs: 1,
        },
      ],
      observations: [{ name: 'total', value: 3, turn: 1, sha256: sha256(JSON.stringify(3)) }],
      artifacts: [
        { name: 'home', path: 'home.png', sha256: sha256(png), bytes: 3, mediaType: 'image/png' },
      ],
      readArtifact: async (name) => (name === 'home' ? png : null),
      decisions: [],
      workspace: entries.length ? keptFiles(manifest, archiveFile(archive)) : null,
      changedFiles: [],
      diff: { patch: '', files: [] },
    },
    skills: [],
  }
}

function archiveFile(archive: Buffer): string {
  const file = join(tempDir('grade-kept'), 'workspace.tar.gz')
  writeFileSync(file, archive)
  return file
}

const defs = (...graders: Array<Grader | Grader[]>): GraderDef[] =>
  graders.flat().map((g) => graderDef(g) as GraderDef)

const grade = async (g: Grader, files?: Record<string, string>): Promise<GradeRecord> =>
  (await runGraders(defs(g), inputs(files), new AbortController().signal))[0] as GradeRecord

const record = (over: Partial<GradeRecord>): GradeRecord => ({
  grader: 'g',
  kind: 'code',
  score: 1,
  weight: 1,
  required: false,
  fingerprint: { digest: 'd', code: 'c' },
  reads: {},
  durationMs: 0,
  ...over,
})

describe('the attempt score', () => {
  test('is the scored grades weighted mean', () => {
    const grades = [record({ score: 1, weight: 3 }), record({ score: 0, weight: 1 })]
    assert.equal(attemptScore(grades), 0.75)
  })
  test('leaves out weight 0 and grades with no score', () => {
    const grades = [
      record({ score: 0, weight: 0 }),
      record({ score: null }),
      record({ score: 0.5 }),
    ]
    assert.equal(attemptScore(grades), 0.5)
  })
  test('is 1 when nothing scored', () => {
    assert.equal(attemptScore([]), 1)
    assert.equal(attemptScore([record({ score: null })]), 1)
  })
  test('is 0 when a required grader scored under 1, whatever its weight', () => {
    const grades = [
      record({ score: 1, weight: 9 }),
      record({ score: 0.9, weight: 0, required: true }),
    ]
    assert.equal(attemptScore(grades), 0)
  })
  test('names what cost it', () => {
    const grades = [
      record({ grader: 'a', score: 0.5 }),
      record({ grader: 'b', score: 0, error: 'grade threw\nat …' }),
      record({ grader: 'c', score: 0, weight: 0 }),
      record({ grader: 'd', score: 1 }),
    ]
    assert.equal(
      scoreFailure(0.5, 1, grades),
      'score 0.50 below 1: a scored 0.50; b errored: grade threw',
    )
  })
})

describe('the grader context', () => {
  test('reads the case, execs, observations and captures', async () => {
    const g = defineGrader<{ input: string }>('reads', {
      grade: async (c) => ({
        key: c.case.key,
        input: c.case.input,
        tests: c.execs[0]?.stdout ?? null,
        total: c.observation('total'),
        missing: c.observation('missing', { optional: true }) ?? null,
        png: (await c.artifact('home')).png.toString(),
        decisions: c.decisions.length,
      }),
    })
    const r = await grade(g)
    assert.deepEqual(r.grade, {
      key: 'iso',
      input: 'PT1H',
      tests: 'ok',
      total: 3,
      missing: null,
      png: 'png',
      decisions: 0,
    })
    assert.equal(r.score, null, 'an object grade has no score')
    assert.deepEqual(r.reads, {
      observations: [{ name: 'total', sha256: sha256('3') }],
      artifacts: [{ name: 'home', sha256: sha256(Buffer.from('png')) }],
    })
  })

  test('throws for an observation or capture the attempt has none of', async () => {
    const observed = await grade(defineGrader('o', { grade: (c) => c.observation('missing') }))
    assert.match(observed.error ?? '', /the attempt made no c\.observe\("missing", …\)/)
    assert.equal(observed.score, 0)
    const captured = await grade(
      defineGrader('a', { grade: async (c) => !!(await c.artifact('x')) }),
    )
    assert.match(captured.error ?? '', /the attempt has no capture named "x"/)
  })

  test('reads kept files within files, by gitignore-style globs', async () => {
    const files = { 'src/app.js': 'app', 'src/gen.js': 'gen', 'package.json': '{}' }
    const g = defineGrader('files', {
      files: ['src/**', '!src/gen.js'],
      grade: async (c) => [await c.readFile('src/app.js'), await c.readFile('./src//app.js')],
    })
    const r = await grade(g, files)
    assert.deepEqual(r.grade, ['app', 'app'])
    assert.deepEqual(r.reads.files, [{ path: 'src/app.js', sha256: sha256(Buffer.from('app')) }])
    for (const path of ['src/gen.js', 'package.json', '../x', '/etc/passwd']) {
      const outside = await grade(
        defineGrader('outside', {
          files: ['src/**', '!src/gen.js'],
          grade: (c) => c.readFile(path),
        }),
        files,
      )
      assert.match(
        outside.error ?? '',
        /grader outside can't read .*: it isn't in its files \(src\/\*\*, !src\/gen\.js\)/,
      )
    }
    const none = await grade(
      defineGrader('none', { grade: (c) => c.readFile('package.json') }),
      files,
    )
    assert.match(none.error ?? '', /it isn't in its files \(none\)\. Add it to files\./)
  })

  test('throws for a file the attempt did not keep', async () => {
    const g = defineGrader('gone', { files: ['**'], grade: (c) => c.readFile('lib/app.js') })
    assert.match((await grade(g, { 'src/app.js': 'x' })).error ?? '', /has no file lib\/app\.js/)
    assert.match((await grade(g)).error ?? '', /the attempt kept no workspace/)
  })

  test('reads data files from the host, which fingerprint the grader', async () => {
    const dir = tempDir('grade-data')
    writeFileSync(join(dir, 'expected.txt'), 'v1')
    writeFileSync(join(dir, 'a.txt'), 'a')
    const make = () =>
      defineGrader('data', ({ file, directory }) => ({
        data: { expected: file(join(dir, 'expected.txt')), all: directory(dir) },
        grade: (c) => c.data as never,
      }))
    const before = await grade(make())
    assert.deepEqual(before.grade, { expected: 'v1', all: { 'a.txt': 'a', 'expected.txt': 'v1' } })
    writeFileSync(join(dir, 'expected.txt'), 'v2')
    const after = await grade(make())
    assert.notEqual(after.fingerprint.data, before.fingerprint.data)
    assert.notEqual(after.fingerprint.digest, before.fingerprint.digest)
    assert.equal(after.fingerprint.code, before.fingerprint.code)
  })

  test('masks the grade', async () => {
    process.env.REEVAL_TEST_GRADE_TOKEN = SECRET
    try {
      const r = await grade(defineGrader('leak', { grade: () => `token ${SECRET}` }))
      assert.ok(typeof r.grade === 'string' && !r.grade.includes(SECRET), String(r.grade))
    } finally {
      delete process.env.REEVAL_TEST_GRADE_TOKEN
    }
  })

  test('masks a number whose digits are a secret', async () => {
    registerSecret('482915736104')
    const r = await grade(
      defineGrader('pin', { grade: () => ({ pin: 482915736104, n: 3, gone: undefined }) }),
    )
    assert.deepEqual(r.grade, { pin: '[REDACTED]', n: 3 })
  })
})

describe('grades and scores', () => {
  test('a boolean grade scores 1 or 0, and score maps any other', async () => {
    assert.equal((await grade(defineGrader('t', { grade: () => true }))).score, 1)
    assert.equal((await grade(defineGrader('f', { grade: () => false }))).score, 0)
    const mapped = await grade(defineGrader('n', { grade: () => 4, score: (n) => n / 8 }))
    assert.equal(mapped.score, 0.5)
    assert.ok(mapped.scoreDigest)
  })

  test('a grader that fails records why and scores 0', async () => {
    const cases: Array<[Grader, RegExp]> = [
      [
        defineGrader('throws', {
          grade: () => {
            throw new Error('boom')
          },
        }),
        /^boom$/,
      ],
      [defineGrader('undef', { grade: () => undefined as never }), /returned undefined/],
      [defineGrader('map', { grade: () => new Map() as never }), /isn't JSON: /],
      [defineGrader('nan', { grade: () => Number.NaN }), /isn't JSON: /],
      [
        defineGrader('slow', { timeout: '50ms', grade: () => new Promise<boolean>(() => {}) }),
        /grade timed out after 50ms/,
      ],
      [defineGrader('big', { grade: () => 'x'.repeat(70_000) }), /over the 65536 a grade may be/],
      [
        defineGrader('score-throws', {
          grade: () => 1,
          score: () => {
            throw new Error('nope')
          },
        }),
        /score threw: nope/,
      ],
      [
        defineGrader('score-range', { grade: () => 1, score: () => 2 }),
        /score returned 2\. A score is a number in \[0, 1\]/,
      ],
      [
        defineGrader('required', { grade: () => 'ok', required: true }),
        /required but its grade has no score/,
      ],
    ]
    for (const [g, why] of cases) {
      const r = await grade(g)
      assert.match(r.error ?? '', why, g.name)
      assert.equal(r.score, 0, g.name)
    }
  })

  test('a group grades once, and each member scores it', async () => {
    let calls = 0
    const [a, b] = defineGraders(['a', 'b'], {
      grade: () => ++calls,
      score: { a: () => 1, b: () => 0.5 },
      weight: { b: 2 },
      required: { a: true },
    })
    const grades = await runGraders(defs([a, b]), inputs(), new AbortController().signal)
    assert.equal(calls, 1)
    assert.deepEqual(
      grades.map((g) => [g.grader, g.group, g.grade, g.score, g.weight, g.required]),
      [
        ['a', ['a', 'b'], 1, 1, 1, true],
        ['b', ['a', 'b'], 1, 0.5, 2, false],
      ],
    )
    assert.notEqual(grades[0]?.fingerprint.code, grades[1]?.fingerprint.code, 'by name')
  })

  test('graders run at once', async () => {
    let running = 0
    let most = 0
    const slow = (name: string) =>
      defineGrader(name, {
        grade: async () => {
          most = Math.max(most, ++running)
          await new Promise((r) => setTimeout(r, 20))
          running--
          return true
        },
      })
    await runGraders(defs(slow('a'), slow('b'), slow('c')), inputs(), new AbortController().signal)
    assert.equal(most, 3)
  })
})

describe('graders with env', () => {
  const started: string[] = []
  const starter =
    (dir: string): SandboxStarter =>
    async (env, timeoutMs, _waiting, held) => {
      const box = await createSandbox(env.sandbox, {
        runId: 'r',
        timeoutMs,
        signal: held(),
        env: {},
        egress: env.egress,
      })
      started.push(box.workdir)
      return {
        box,
        image: `image of ${dir}`,
        close: async () => {
          started.splice(started.indexOf(box.workdir), 1)
          await box.destroy()
        },
      }
    }
  const env = (dir: string) => ({ env: fakeSandbox({ dir }), egress: 'allow-all' as const })

  test('copy their files into a fresh sandbox, which c.sandbox runs in and is gone after', async () => {
    const dir = tempDir('grade-env')
    const g = defineGrader('hidden', {
      ...env(dir),
      files: ['src/**'],
      grade: async (c) => {
        await c.sandbox.writeFile('test/hidden.txt', 'hidden')
        const ls = await c.sandbox.exec('ls -R src test && cat src/a.txt', { cwd: '.' })
        return { ls: ls.stdout, secret: await c.sandbox.readFile('secret.txt') }
      },
    })
    const files = { 'src/a.txt': 'a', 'src/b/c.txt': 'c', 'secret.txt': 's' }
    const base = inputs(files)
    const [r] = await runGraders(
      defs(g),
      { ...base, sandboxes: starter(dir) },
      new AbortController().signal,
    )
    assert.equal(r?.error, undefined)
    const out = r?.grade as { ls: string; secret: null }
    assert.match(out.ls, /a\.txt/)
    assert.match(out.ls, /hidden\.txt/)
    assert.ok(out.ls.endsWith('a'), out.ls)
    assert.equal(out.secret, null)
    assert.deepEqual(
      r?.reads.files?.map((f) => f.path),
      ['src/a.txt', 'src/b/c.txt'],
    )
    assert.equal(r?.fingerprint.image, `image of ${dir}`)
    assert.deepEqual(started, [])
  })

  test("that don't start fail the attempt with the infra error, recording no grade", async () => {
    const dir = tempDir('grade-env-down')
    const g = defineGrader('down', { ...env(dir), grade: () => true })
    const failing: SandboxStarter = async () => {
      throw new InfraError('no docker')
    }
    await assert.rejects(
      runGraders(defs(g), { ...inputs(), sandboxes: failing }, new AbortController().signal),
      (error: Error) => error instanceof InfraError && /no docker/.test(error.message),
    )
  })

  test('c.sandbox throws for a grader without env', async () => {
    const r = await grade(defineGrader('bare', { grade: (c) => c.sandbox.exec('true') }))
    assert.match(r.error ?? '', /grader bare has no env, so it has no c\.sandbox/)
  })

  test("take the attempt's own slot first, then the run's or the attempt's freed one", async () => {
    const box = docker()
    const slot = graderSlots(1, box)
    const signal = new AbortController().signal
    const first = await slot(box, signal)
    // The run's only slot is someone else's, so the second waits for the attempt's.
    const other = await acquire({ attempts: 1 })
    let second: Awaited<ReturnType<typeof slot>> | undefined
    const waiting = slot(box, signal).then((lease) => {
      second = lease
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(second, undefined)
    first.release()
    await waiting
    assert.ok(second)
    other.release()
    // The run's slot, free now, isn't held: a third takes it while the second holds the attempt's.
    const third = await slot(box, signal)
    third.release()
    second.release()
  })

  test("on another provider than the attempt's, lease that provider's maxConcurrent", async () => {
    const box = docker({ maxConcurrent: 1 })
    const signal = new AbortController().signal
    // Two attempts on the fake sandbox, each grading in Docker.
    const one = graderSlots(4, fakeSandbox())
    const two = graderSlots(4, fakeSandbox())
    const first = await one(box, signal)
    let second: Awaited<ReturnType<typeof two>> | undefined
    const waiting = two(box, signal).then((lease) => {
      second = lease
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(second, undefined, 'two docker({ maxConcurrent: 1 }) sandboxes overlapped')
    first.release()
    await waiting
    assert.ok(second)
    second.release()
  })

  test('the timeout covers starting the sandbox', async () => {
    const dir = tempDir('grade-env-hang')
    const g = defineGrader('hangs', { ...env(dir), timeout: '1s', grade: () => true })
    const hangs: SandboxStarter = (_env, _timeout, _waiting, held) =>
      new Promise((_resolve, reject) => {
        const signal = held()
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    const [r] = await runGraders(
      defs(g),
      { ...inputs(), sandboxes: hangs },
      new AbortController().signal,
    )
    assert.equal(r?.error, 'grade timed out after 1s')
  })

  test("the timeout doesn't count waiting for a slot", async () => {
    const dir = tempDir('grade-env-queue')
    const slot = graderSlots(4, fakeSandbox())
    const queued: SandboxStarter = async (env, timeoutMs, waiting, held) => {
      const lease = await slot(docker({ maxConcurrent: 1 }), waiting)
      const box = await createSandbox(env.sandbox, {
        runId: 'r',
        timeoutMs,
        signal: held(),
        env: {},
        egress: env.egress,
      })
      return {
        box,
        image: 'image',
        close: async () => {
          await box.destroy()
          lease.release()
        },
      }
    }
    const slow = (name: string) =>
      defineGrader(name, {
        ...env(dir),
        timeout: '1s',
        grade: async () => {
          await new Promise((r) => setTimeout(r, 600))
          return true
        },
      })
    const grades = await runGraders(
      defs(slow('a'), slow('b'), slow('c')),
      { ...inputs(), sandboxes: queued },
      new AbortController().signal,
    )
    assert.deepEqual(
      grades.map((g) => [g.grader, g.score, g.error]),
      [
        ['a', 1, undefined],
        ['b', 1, undefined],
        ['c', 1, undefined],
      ],
    )
  })
})

describe('defineGrader', () => {
  const refused: Array<[() => unknown, RegExp]> = [
    [
      () => defineGrader('x', { grade: () => true, env: tart({ image: 'x' }) }),
      /env in defineGrader\("x"\) must be docker\(\), podman\(\) or fakeSandbox\(\) from reeval\/sandbox \(got the tart sandbox\)/,
    ],
    [
      () => defineGrader('x', { grade: () => true, egress: 'allow-all' }),
      /egress in defineGrader\("x"\) is the network of its env sandbox, and it has no env/,
    ],
    [
      () => defineGrader('x', { grade: () => true, env: docker(), egress: 'none' as never }),
      /egress in defineGrader\("x"\) is 'proxy'/,
    ],
    [() => defineGrader('x', { grade: () => true, env: fakeSandbox() }), /deny-all/],
    [() => defineGrader('', { grade: () => true }), /needs a name of at most 80 letters/],
    [() => defineGrader('a b', { grade: () => true }), /needs a name/],
    [() => defineGrader('x', {} as never), /needs grade, a function/],
    [
      () => defineGrader('x', { grade: () => true, judge: 1 } as never),
      /takes grade or judge, not both/,
    ],
    [
      () => defineGrader('x', { grade: () => true, weight: -1 }),
      /weight in defineGrader\("x"\) must be a number of 0 or more/,
    ],
    [
      () => defineGrader('x', { grade: () => true, required: 1 as never }),
      /required in .* must be true or false/,
    ],
    [
      () => defineGrader('x', { grade: () => true, files: 'src' as never }),
      /files in .* must be a list of globs/,
    ],
    [
      () => defineGrader('x', { grade: () => true, revision: 1.5 }),
      /revision in .* must be a whole number/,
    ],
    [
      () => defineGrader('x', { grade: () => true, timeout: 'soon' as never }),
      /timeout in defineGrader\("x"\): Invalid duration "soon"/,
    ],
    [
      () =>
        defineGrader('x', ({ file }) => ({ grade: () => true, data: { a: file('nope.json') } })),
      /data\.a in .*nope\.json doesn't exist\. Paths are relative to the file that defines the grader/,
    ],
    [
      () => defineGraders(['a', 'b'], { grade: () => 1, score: { a: () => 1 } as never }),
      /score in defineGraders\(\["a","b"\]\) must give each grader its score function/,
    ],
    [() => defineGraders(['a', 'a'], { grade: () => 1, score: { a: () => 1 } }), /names a twice/],
  ]
  for (const [define, why] of refused) {
    test(`refuses ${why.source.slice(0, 60)}`, () => assert.throws(define, why))
  }
})

describe('the code digest', () => {
  test('covers the function and the local modules of its file', async () => {
    const dir = tempDir('grade-digest')
    writeFileSync(join(dir, 'helper.ts'), 'export const MIN = 1\n')
    writeFileSync(
      join(dir, 'grader.ts'),
      "import { MIN } from './helper.ts'\nexport const x = MIN\n",
    )
    const fn = (n: number) => n > 1
    const first = functionDigest(fn, join(dir, 'grader.ts'), 'grade')
    assert.equal(functionDigest(fn, join(dir, 'grader.ts'), 'grade'), first)
    assert.notEqual(
      functionDigest((n: number) => n > 2, join(dir, 'grader.ts'), 'grade'),
      first,
    )
    writeFileSync(join(dir, 'helper.ts'), 'export const MIN = 2\n')
    assert.notEqual(
      functionDigest(fn, join(dir, 'grader.ts'), 'grade'),
      first,
      'an imported module changed',
    )
  })

  test('follows require, # imports, re-exports and workspace packages, not installed ones', () => {
    const dir = join(tempDir('grade-digest-resolve'), 'proj')
    const files: Record<string, string> = {
      'package.json': JSON.stringify({ name: 'p', imports: { '#lib/*': './lib/*.ts' } }),
      'grader.ts': [
        "import { a } from './a.js'",
        "export * from './b'",
        "import { s } from '#lib/s'",
        "import { w } from '@w/util'",
        "import { e } from 'ext'",
        "const c = require('./c.cjs')",
        'export const x = [a, s, w, e, c]',
      ].join('\n'),
      'a.ts': 'export const a = 1\n',
      'b.ts': "export { d } from './d'\n",
      'd.ts': 'export const d = 1\n',
      'c.cjs': 'module.exports = 1\n',
      'lib/s.ts': 'export const s = 1\n',
      '../ws/util/package.json': JSON.stringify({ name: '@w/util', exports: './index.ts' }),
      '../ws/util/index.ts': 'export const w = 1\n',
      'node_modules/ext/package.json': JSON.stringify({ name: 'ext', main: 'index.js' }),
      'node_modules/ext/index.js': 'exports.e = 1\n',
    }
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true })
      writeFileSync(join(dir, path), text)
    }
    mkdirSync(join(dir, 'node_modules/@w'), { recursive: true })
    symlinkSync(join(dir, '../ws/util'), join(dir, 'node_modules/@w/util'))
    const fn = () => 1
    const digest = () => functionDigest(fn, join(dir, 'grader.ts'), 'grade')
    let last = digest()
    for (const path of ['a.ts', 'd.ts', 'c.cjs', 'lib/s.ts', '../ws/util/index.ts']) {
      writeFileSync(join(dir, path), `${files[path]}// edited\n`)
      const next = digest()
      assert.notEqual(next, last, `${path} is in the digest`)
      last = next
    }
    writeFileSync(join(dir, 'node_modules/ext/index.js'), 'exports.e = 2\n')
    assert.equal(digest(), last, 'an installed package is left to the lockfile')
  })

  test("refuses a bound function, whose source it can't read", () => {
    const check = (min: number, g: number) => g >= min
    assert.throws(
      () => defineGrader('bound', { grade: () => 1, score: check.bind(null, 3) }),
      /score in defineGrader\("bound"\) is a bound or built-in function/,
    )
    assert.throws(
      () => defineGrader('bound', { grade: check.bind(null, 3) as never }),
      /grade in defineGrader\("bound"\) is a bound or built-in function/,
    )
  })

  test('defineGraders<C>() defines the group as the plain call does', () => {
    const [a, b] = defineGraders<{ input: string }>()(['a', 'b'], {
      grade: (c) => c.case.input.length,
      score: { a: () => 1, b: () => 0 },
    })
    assert.deepEqual([a?.name, b?.name], ['a', 'b'])
  })
})

describe('graders on an attempt', () => {
  const config = fakeConfig({ harness: "{ script: [[{ write: { 'out.txt': 'hello' } }]] }" })

  test('read the case and the kept workspace once the task returns, into the record', async (t) => {
    const p = await project('grade-run', {
      'reeval.config.ts': config,
      'evals/graders.ts': `import { defineGrader } from 'reeval'
export const says = defineGrader<{ word: string }>('says', {
  files: ['out.txt'],
  grade: async (c) => (await c.readFile('out.txt')) === c.case.word,
})
export const key = defineGrader('key', { grade: (c) => c.case.key })
`,
      'evals/cased.eval.ts': `import { defineEval } from 'reeval'
import { key, says } from './graders.ts'
export default defineEval({
  cases: [{ key: 'hi', word: 'hello' }, { key: 'bye', word: 'goodbye' }],
  graders: [says, key],
  task: async (c) => void (await c.send('write it')),
})
`,
      'evals/plain.eval.ts': `import { defineEval } from 'reeval'
import { key } from './graders.ts'
export default defineEval({ graders: [key], task: async (c) => void (await c.send('write it')) })
`,
    })
    const r = await runCli(p.dir, ['run', '--output-logs', 'full'], { signal: t.signal })
    assert.equal(r.code, 1, r.stdout + r.stderr)
    const { run } = readRun(p.dir)
    const attempts = run.evals.flatMap((e) => e.attempts.map((a) => ({ name: e.name, ...a })))
    const of = (name: string, c?: string) => attempts.find((a) => a.name === name && a.case === c)
    assert.deepEqual(
      of('cased', 'hi')?.grades?.map((g) => [g.grader, g.grade, g.score]),
      [
        ['says', true, 1],
        ['key', 'hi', null],
      ],
    )
    assert.equal(of('cased', 'hi')?.score, 1)
    assert.equal(of('cased', 'hi')?.outcome, 'pass')
    assert.equal(of('cased', 'bye')?.score, 0)
    assert.equal(of('cased', 'bye')?.outcome, 'fail')
    assert.equal(of('cased', 'bye')?.error?.message, 'score 0.00 below 1: says scored 0.00')
    assert.deepEqual(
      of('plain')?.grades?.map((g) => g.grade),
      [''],
      'an eval without cases',
    )
    assert.match(r.stdout, /grade says {2}score 1\.00/)
    assert.match(r.stdout, /grade key {2}recorded/)
  })

  test("don't run after the task throws or times out", async (t) => {
    const marker = join(tempDir('grade-marker'), 'ran')
    const p = await project('grade-throw', {
      'reeval.config.ts': config,
      'evals/graders.ts': `import { writeFileSync } from 'node:fs'
import { defineGrader } from 'reeval'
export const marks = defineGrader('marks', {
  grade: () => (writeFileSync(${JSON.stringify(marker)}, 'x'), true),
})
`,
      'evals/throws.eval.ts': `import { defineEval } from 'reeval'
import { marks } from './graders.ts'
export default defineEval({
  graders: [marks],
  task: async (c) => {
    await c.send('write it')
    throw new Error('the task failed')
  },
})
`,
      'evals/slow.eval.ts': `import { defineEval } from 'reeval'
import { marks } from './graders.ts'
export default defineEval({
  graders: [marks],
  timeout: '1s',
  task: (c) => new Promise((resolve) => c.signal.addEventListener('abort', resolve)),
})
`,
    })
    const r = await runCli(p.dir, ['run'], { signal: t.signal })
    assert.equal(r.code, 1, r.stdout + r.stderr)
    const { run } = readRun(p.dir)
    const throws = run.evals.find((e) => e.name === 'throws')?.attempts[0]
    assert.equal(throws?.grades, undefined)
    assert.equal(throws?.score, 0, 'a task that threw scores 0')
    const slow = run.evals.find((e) => e.name === 'slow')?.attempts[0]
    assert.equal(slow?.error?.kind, 'timeout')
    assert.equal(slow?.grades, undefined)
    assert.equal(slow?.score, undefined, 'a timeout has no score')
    assert.equal(existsSync(marker), false, 'no grader ran')
  })
})
