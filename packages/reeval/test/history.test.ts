import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync } from 'node:fs'
import { appendFile, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { describe, test } from 'node:test'
import { openArchive, writeArchive } from '../src/archive/index.ts'
import {
  ensureHistoryGitattributes,
  HISTORY_GITATTRIBUTES,
  HISTORY_GITIGNORE,
  parseCheckIgnore,
} from '../src/history/ignore.ts'
import type { RunRecord } from '../src/history/types.ts'
import { readableRunReport } from '../src/view/report/schema.ts'
import { baseEnv, fakeConfig, project, readRun, recordedRuns, runCli, tempDir } from './helpers.ts'
import { fixture } from './support/fixture.ts'

const GIT_ENV = {
  ...baseEnv,
  GIT_AUTHOR_NAME: 'Test Author',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test Author',
  GIT_COMMITTER_EMAIL: 'test@example.com',
}
const sh = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' }).trim()

const HISTORY = 'evals/.history'
const agent = `import { defineEval, expect } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('write hello.txt')
    expect(await c.judge('Did it write hello.txt?', { diff: true })).toPass()
  },
})
`
const failing = `import { defineEval, expect } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('write hello.txt')
    await expect(c.exec('exit 4')).toSucceed()
  },
})
`
const logged = `import { defineEval, expect } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('write hello.txt')
    await expect(c.exec('echo ok')).toSucceed()
  },
})
`
/** An eval whose environment has a setup step, so its attempt writes setup.log and checks/1.log. */
const setUp = (command: string) => `import { defineEnvironment, defineEval, expect } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
const environment = defineEnvironment('set-up', {
  sandbox: fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) }),
  setup: [{ run: 'echo ready' }],
})
export default defineEval({
  environment,
  async task(c) {
    await c.send('write hello.txt')
    await expect(c.exec('${command}')).toSucceed()
  },
})
`
const harness = (text = 'Wrote it') => `{ files: { 'hello.txt': 'hi\\n' }, text: '${text}' }`

/** A reeval project that is its own committed git repo, with a known author. */
async function gitProject(name: string, files: Record<string, string>, extra = '') {
  const p = await project(name, {
    '.gitignore': '.reeval/\nnode_modules/\nsandboxes/\n',
    'reeval.config.ts': fakeConfig({ harness: harness(), extra }),
    ...files,
  })
  sh(p.dir, 'init', '-q', '-b', 'main')
  sh(p.dir, 'config', 'user.name', 'Test Author')
  sh(p.dir, 'config', 'user.email', 'test@example.com')
  sh(p.dir, 'add', '-A')
  sh(p.dir, 'commit', '-q', '-m', 'init')
  return p
}

const historyJson = async (dir: string, args: string[] = []) => {
  const r = await runCli(dir, ['history', '--json', ...args])
  assert.equal(r.code, 0, r.stderr)
  return JSON.parse(r.stdout) as {
    runs: Array<{ runId: string }>
    rows: Array<{ id: string; outcomes: string[] }>
    orphaned: string[]
  }
}

describe('recording runs into evals/.history', () => {
  test('reeval run writes scratch; reeval record promotes it next to the evals', async () => {
    const p = await gitProject('record-basic', { 'evals/agent.eval.ts': agent })
    assert.equal((await runCli(p.dir)).code, 0)
    assert.deepEqual(recordedRuns(p.dir), [], 'nothing recorded without --record')
    const { run, evals } = readRun(p.dir)
    assert.match(run.runId, /^\d{8}T\d{6}Z_[0-9a-f]{7}_test-author_[0-9a-z]{4}$/)
    assert.equal(run.git?.sha.slice(0, 7), run.runId.split('_')[1])
    assert.deepEqual(
      evals[0]?.trial.egress,
      {
        policy: 'proxy',
        allowed: null,
        recorded: false,
        contacted: [],
        blocked: [],
        expectedBlocked: [],
        unresolved: [],
      },
      'the fake sandbox records no traffic, and the record says so',
    )
    const state = (await runCli(p.dir, ['show', run.runId])).stdout
    assert.match(state, /\n {2}Lockfiles +none found\n/)
    assert.match(state, /\n {2}Images +none \(fake sandbox\)\n/)
    assert.match(state, /\n {2}Judge +fake · threshold 0\.8 · version [0-9a-f]{12}\n/)
    assert.match(state, /\n {2}Context +no skills, rules or MCP config found in the sandbox\n/)

    const r = await runCli(p.dir, ['record', '--artifacts', 'all'])
    assert.equal(r.code, 0, r.stderr)
    assert.match(
      r.stdout,
      new RegExp(`recorded evals/\\.history/${run.runId}\\.json \\+ \\d+ artifact files`),
    )
    assert.match(r.stdout, /Commit it with git/)
    assert.deepEqual(recordedRuns(p.dir), [run.runId])
    const recorded = readRun(p.dir, { history: HISTORY })
    const [e] = recorded.evals
    assert.ok(e)
    assert.equal(recorded.run.artifacts, 'all')
    const trial = e.attempts[0]
    for (const file of [
      'summary.md',
      'report.json',
      trial?.files.transcript?.path,
      trial?.files.diff?.path,
    ]) {
      assert.ok(file && existsSync(join(recorded.dir, file)), file)
    }
    const report = readableRunReport(JSON.parse(recorded.read('report.json')))
    assert.deepEqual(
      report.attempts.map((a) => [a.id, a.key]),
      [['A1', trial?.key]],
      'report.json is the RunReport summary.md renders',
    )
    const scratchReport = readableRunReport(
      JSON.parse(readFileSync(join(p.dir, '.reeval/runs', run.runId, 'report.json'), 'utf8')),
    )
    assert.ok(report.attempts[0]?.facts, 'the recorded report has the facts of the kept transcript')
    assert.deepEqual(
      scratchReport.attempts.map((a) => a.facts),
      report.attempts.map((a) => a.facts),
      ".reeval/runs' report.json has the same facts as the history copy",
    )
    const summary = recorded.read('summary.md')
    assert.match(summary, /^# agent$/m, 'passes get detail')
    assert.match(
      summary,
      /^\| <a id="attempt-[a-z0-9-]+"><\/a>A1 \| agent \| fake \| fake \| pass \|/m,
    )
    assert.match(summary, /^## Judgments$/m)
    assert.match(summary, /Did it write hello\.txt/)
    const [input] = JSON.parse(recorded.read(e.trial.files.judgeInput?.path ?? ''))
    assert.deepEqual(input.state.diff.$ref, 'diff.patch', 'the judge input points at diff.patch')
    assert.equal(sh(p.dir, 'status', '--porcelain'), '?? evals/.history/', 'plain files for git')

    assert.equal(readFileSync(join(p.dir, HISTORY, '.gitignore'), 'utf8'), HISTORY_GITIGNORE)
    assert.equal(
      readFileSync(join(p.dir, HISTORY, '.gitattributes'), 'utf8'),
      HISTORY_GITATTRIBUTES,
    )
    for (const file of [`${run.runId}.json`, `${run.runId}/${trial?.files.transcript?.path}`]) {
      assert.equal(
        sh(p.dir, 'check-attr', 'linguist-generated', '--', `${HISTORY}/${file}`),
        `${HISTORY}/${file}: linguist-generated: true`,
        'GitHub collapses recorded files in review',
      )
    }
    assert.equal(
      sh(p.dir, 'check-attr', 'linguist-generated', '--', `${HISTORY}/notes.md`),
      `${HISTORY}/notes.md: linguist-generated: unspecified`,
      'a file that is no run of the history folder stays reviewable',
    )
    assert.match(
      (await runCli(p.dir, ['record', run.runId, '--artifacts', 'all'])).stdout,
      /already recorded/,
    )

    // The history folder and .reeval/ never make the next run dirty.
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    assert.equal(readRun(p.dir).run.git?.dirty, false)
    assert.equal(recordedRuns(p.dir).length, 2)

    const shown = await runCli(p.dir, ['show', 'latest', '--json'])
    assert.equal((JSON.parse(shown.stdout) as RunRecord).kind, 'reeval-run')
    assert.match((await runCli(p.dir, ['show', run.runId, '--md'])).stdout, /^# agent$/m)
    assert.match((await runCli(p.dir, ['history'])).stdout, /✓✓ +2\/2 +agent/)
  })

  test('a parent *.log does not drop recorded logs', async () => {
    const p = await gitProject('record-log-tracked', {
      '.gitignore': '.reeval/\nnode_modules/\nsandboxes/\n*.log\n',
      'evals/logged.eval.ts': logged,
    })
    assert.equal((await runCli(p.dir)).code, 0)
    const r = await runCli(p.dir, ['record', '--artifacts', 'all'])
    assert.equal(r.code, 0, r.stderr)
    assert.doesNotMatch(r.stdout + r.stderr, /git ignores/)
    assert.equal(readFileSync(join(p.dir, HISTORY, '.gitignore'), 'utf8'), HISTORY_GITIGNORE)

    const recorded = readRun(p.dir, { history: HISTORY })
    const log = recorded.evals[0]?.trial.checks[0]?.log?.path
    assert.ok(log, 'c.exec writes checks/n.log')
    const logPath = join(HISTORY, recorded.run.runId, log)
    assert.equal(
      spawnSync('git', ['check-ignore', '-q', '--no-index', logPath], {
        cwd: p.dir,
        env: GIT_ENV,
      }).status,
      1,
      `${logPath} is not ignored`,
    )
    sh(p.dir, 'add', HISTORY)
    assert.match(sh(p.dir, 'diff', '--cached', '--name-only'), /checks\/1\.log/)
    assert.match(sh(p.dir, 'diff', '--cached', '--name-only'), /\.gitignore/)
    assert.match(sh(p.dir, 'diff', '--cached', '--name-only'), /\.gitattributes/)
  })

  test('reeval record warns when git still ignores a written file', async () => {
    const p = await gitProject('record-log-ignored', {
      '.gitignore': '.reeval/\nnode_modules/\nsandboxes/\n*.log\n.gitattributes\n',
      'evals/logged.eval.ts': logged,
    })
    mkdirSync(join(p.dir, HISTORY), { recursive: true })
    await writeFile(join(p.dir, HISTORY, '.gitignore'), '# local, no un-ignore\n')
    assert.equal((await runCli(p.dir)).code, 0)
    const r = await runCli(p.dir, ['record', '--artifacts', 'all'])
    assert.equal(r.code, 0, r.stderr)
    assert.match(
      r.stdout,
      /^warning: git ignores \d+ recorded file\(s\); they won't be committed:$/m,
    )
    assert.match(r.stdout, /checks\/1\.log {2}ignored by \*\.log \(\.gitignore:\d+\)$/m)
    assert.match(
      r.stdout,
      /\.history\/\.gitattributes {2}ignored by \.gitattributes \(\.gitignore:\d+\)$/m,
    )
    assert.match(r.stdout, /^recorded evals\/\.history\/\S+\.json/m)
    const again = await runCli(p.dir, ['record', '--artifacts', 'all'])
    assert.equal(again.code, 0, again.stderr)
    assert.match(
      again.stdout,
      /\.history\/\.gitattributes {2}ignored by \.gitattributes \(\.gitignore:\d+\)\n.* is already recorded$/m,
      'a run already recorded still names the folder file git drops',
    )
  })

  test('history.archive writes each recorded run as a zip, and reeval record rebuilds one', async () => {
    const p = await gitProject(
      'record-archive',
      { 'evals/agent.eval.ts': agent },
      'history: { archive: true },',
    )
    const first = await runCli(p.dir, ['run', '--record'])
    assert.equal(first.code, 0, first.stdout + first.stderr)
    const [runId] = recordedRuns(p.dir)
    assert.ok(runId)
    const zip = join(p.dir, HISTORY, `${runId}.zip`)
    assert.match(
      first.stdout,
      new RegExp(`; archived it in ${HISTORY}/${runId}\\.zip\\. Commit it`),
    )
    const manifest = async () => {
      const archive = await openArchive(zip)
      try {
        await archive.verify()
        assert.deepEqual(
          await archive.read(`${runId}.json`),
          readFileSync(join(p.dir, HISTORY, `${runId}.json`)),
          'the record in the zip is the one recorded',
        )
        return archive.manifest
      } finally {
        await archive.close()
      }
    }
    const was = await manifest()
    assert.equal(was.revision, 1)
    const archived = was.files.map((f) => f.path)
    assert.equal(archived[0], `${runId}.json`)
    assert.ok(archived.includes(`${runId}/summary.md`), 'archive keeps summary.md')
    assert.ok(archived.includes(`${runId}/report.json`), 'archive keeps report.json')
    assert.ok(
      archived.some((p) => p.endsWith('/diff.patch')),
      'evidence default keeps a passing attempt diff in the archive',
    )
    assert.ok(archived.includes(`${runId}/spans.jsonl`), "archive keeps the run's trace")
    assert.equal(archived.length, 5)
    assert.equal(
      sh(p.dir, 'check-attr', 'binary', '--', `${HISTORY}/${runId}.zip`),
      `${HISTORY}/${runId}.zip: binary: set`,
    )

    const again = await runCli(p.dir, ['record', runId])
    assert.equal(again.code, 0, again.stderr)
    assert.match(again.stdout, /is already recorded$/m, 'an archive that lists the run is kept')

    await rm(zip)
    const rebuilt = await runCli(p.dir, ['record', runId])
    assert.match(rebuilt.stdout, /is already recorded; archived it in .*\.zip$/m)
    const { createdAt: _now, ...now } = await manifest()
    const { createdAt: _was, ...before } = was
    assert.deepEqual(now, before, 'a missing archive is written as it was')

    await writeArchive(zip, {
      contents: 'run',
      runId,
      revision: 3,
      files: [{ path: `${runId}.json`, data: readFileSync(join(p.dir, HISTORY, `${runId}.json`)) }],
    })
    assert.equal((await runCli(p.dir, ['record', runId])).code, 0)
    assert.equal((await manifest()).revision, 4, 'a stale archive is written again, a revision on')

    await writeFile(zip, 'not a zip')
    assert.equal((await runCli(p.dir, ['record', runId])).code, 0)
    assert.equal((await manifest()).revision, 1, 'one that is not an archive is written afresh')

    await rm(zip)
    await writeFile(join(p.dir, HISTORY, runId, 'summary.md'), '# edited by hand\n')
    mkdirSync(join(p.dir, HISTORY, runId, 'analysis'))
    await writeFile(join(p.dir, HISTORY, runId, 'analysis', 'later.json'), '{}\n')
    assert.equal((await runCli(p.dir, ['record', runId])).code, 0)
    const fromDisk = await openArchive(zip)
    try {
      assert.deepEqual(
        (await fromDisk.read(`${runId}/summary.md`)).toString(),
        '# edited by hand\n',
        'the zip holds the files as they are in the history folder',
      )
      assert.equal(fromDisk.has(`${runId}/analysis/later.json`), false, 'not what came later')
    } finally {
      await fromDisk.close()
    }
    assert.deepEqual(
      readdirSync(join(p.dir, HISTORY)).filter((n) => n.startsWith('.tmp-')),
      [],
      'no write in progress is left behind',
    )
  })

  test('an archive reeval cannot open is never written over', {
    skip: (process.getuid?.() === 0 || process.platform === 'win32') && 'needs file permissions',
  }, async () => {
    const p = await gitProject(
      'record-archive-unreadable',
      { 'evals/agent.eval.ts': agent },
      'history: { archive: true },',
    )
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    const [runId] = recordedRuns(p.dir)
    assert.ok(runId)
    const zip = join(p.dir, HISTORY, `${runId}.zip`)
    const before = readFileSync(zip)
    chmodSync(zip, 0o000)
    try {
      const r = await runCli(p.dir, ['record', runId])
      assert.notEqual(r.code, 0, r.stdout)
      assert.match(r.stderr, new RegExp(`Recorded ${runId}, but couldn't archive it: EACCES`))
    } finally {
      chmodSync(zip, 0o644)
    }
    assert.deepEqual(readFileSync(zip), before)
  })

  test('a parent *.zip ignore leaves the history folder archives committed', async () => {
    const p = await gitProject(
      'record-archive-ignored',
      { 'evals/agent.eval.ts': agent },
      'history: { archive: true },',
    )
    await appendFile(join(p.dir, '.gitignore'), '*.zip\n')
    mkdirSync(join(p.dir, HISTORY), { recursive: true })
    const older = HISTORY_GITIGNORE.replace('!*.zip\n', '')
    await writeFile(join(p.dir, HISTORY, '.gitignore'), older)
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    const [runId] = recordedRuns(p.dir)
    const r = spawnSync('git', ['check-ignore', '-q', `${HISTORY}/${runId}.zip`], { cwd: p.dir })
    assert.equal(r.status, 1, 'git does not ignore the archive')
    assert.equal(
      readFileSync(join(p.dir, HISTORY, '.gitignore'), 'utf8'),
      `${older}!*.zip\n`,
      'a history .gitignore without the rule gains it',
    )
  })

  test("history.debugArchive zips the run's .reeval/debug data there, and reeval clean removes it", async () => {
    const p = await gitProject(
      'record-debug-archive',
      { 'evals/agent.eval.ts': agent },
      'history: { debugArchive: true },',
    )
    const r = await runCli(p.dir, ['run', '--record'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const [runId] = recordedRuns(p.dir)
    assert.ok(runId)
    const debug = join(p.dir, '.reeval', 'debug')
    const zip = join(debug, `${runId}.zip`)
    assert.match(
      r.stdout,
      new RegExp(
        `Commit it with git\\.\\nZipped its debug data in \\.reeval/debug/${runId}\\.zip, which stays out of git\\.`,
      ),
    )
    const loose = readdirSync(join(debug, runId), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => `${runId}/${relative(join(debug, runId), join(e.parentPath, e.name))}`)
      .sort()
    assert.ok(loose.length > 0, 'the run left debug data')
    const archive = await openArchive(zip)
    try {
      await archive.verify()
      assert.equal(archive.manifest.contents, 'debug')
      assert.equal(archive.manifest.debugLevel, 'all')
      assert.deepEqual(
        archive.manifest.files.map((f) => f.path),
        loose,
        'the zip holds every debug file of the run',
      )
    } finally {
      await archive.close()
    }
    assert.deepEqual(
      readdirSync(join(p.dir, HISTORY)).filter((n) => n.endsWith('.zip')),
      [],
      'nothing lands in the history folder',
    )
    const again = await runCli(p.dir, ['record', runId])
    assert.match(again.stdout, /is already recorded$/m, 'a debug archive that lists it is kept')

    const [log] = loose
    assert.ok(log)
    await appendFile(join(debug, log), 'later\n')
    const changed = await runCli(p.dir, ['record', runId])
    assert.match(changed.stdout, /is already recorded\nZipped its debug data in /)
    const rewritten = await openArchive(zip)
    assert.equal(rewritten.manifest.revision, 2, 'debug data that changed is zipped again')
    await rewritten.close()

    await rm(join(debug, runId), { recursive: true })
    assert.equal((await runCli(p.dir, ['record', runId])).code, 0)
    assert.ok(existsSync(zip), 'with its folder gone, the zip is the only copy and stays')
    for (let i = 0; i < 2; i++) assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    const cutShort = [`.tmp-${runId}.claim`, `.tmp-0a1b2c3d-${runId}.zip`]
    for (const name of cutShort) await writeFile(join(debug, name), '')
    const kept = await runCli(p.dir, ['clean', '--keep', '2'])
    assert.match(kept.stdout, /Removed debug data and snapshots for 1 run /)
    assert.equal(existsSync(zip), false, 'a run with only its zip left counts, and goes first')
    for (const name of cutShort) {
      assert.equal(existsSync(join(debug, name)), false, `${name}, cut short, goes with its run`)
    }
    const newer = readdirSync(debug).filter((n) => n.endsWith('.zip'))
    assert.equal(newer.length, 2, 'the newer runs keep theirs')

    const clean = await runCli(p.dir, ['clean'])
    assert.equal(clean.code, 0, clean.stderr)
    assert.match(clean.stdout, /Removed debug data and snapshots for 2 runs /)
    assert.deepEqual(readdirSync(debug), [], 'reeval clean removes each zip with its run')
  })

  test('without history.archive no zip is written', async () => {
    const p = await gitProject('record-no-archive', { 'evals/agent.eval.ts': agent })
    const r = await runCli(p.dir, ['run', '--record'])
    assert.equal(r.code, 0, r.stderr)
    assert.doesNotMatch(r.stdout, /archived/)
    assert.deepEqual(
      readdirSync(join(p.dir, HISTORY)).filter((n) => n.endsWith('.zip')),
      [],
    )
  })

  test('a history .gitattributes that has some of the rules gains only the others', async () => {
    const dir = tempDir('gitattributes-some')
    const [json, folder, zip] = HISTORY_GITATTRIBUTES.split('\n').filter(
      (l) => l && !l.startsWith('#'),
    )
    const before = `# Recorded runs\n${json}\n${folder}\n`
    await writeFile(join(dir, '.gitattributes'), before)
    await ensureHistoryGitattributes(dir)
    assert.equal(readFileSync(join(dir, '.gitattributes'), 'utf8'), `${before}${zip}\n`)
    await ensureHistoryGitattributes(dir)
    assert.equal(readFileSync(join(dir, '.gitattributes'), 'utf8'), `${before}${zip}\n`, 'once')
    const crlf = before.replaceAll('\n', '\r\n')
    await writeFile(join(dir, '.gitattributes'), crlf)
    await ensureHistoryGitattributes(dir)
    assert.equal(
      readFileSync(join(dir, '.gitattributes'), 'utf8'),
      `${crlf}${zip}\r\n`,
      'its line ends',
    )
  })

  test("an existing .gitattributes keeps its lines and gains the history's", async () => {
    const p = await gitProject('record-gitattributes', { 'evals/agent.eval.ts': agent })
    mkdirSync(join(p.dir, HISTORY), { recursive: true })
    const own = '*.png binary'
    await writeFile(join(p.dir, HISTORY, '.gitattributes'), own)
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    const path = join(p.dir, HISTORY, '.gitattributes')
    assert.equal(readFileSync(path, 'utf8'), `${own}\n${HISTORY_GITATTRIBUTES}`)
    const [runId] = recordedRuns(p.dir)
    assert.equal(
      sh(p.dir, 'check-attr', 'linguist-generated', '--', `${HISTORY}/${runId}.json`),
      `${HISTORY}/${runId}.json: linguist-generated: true`,
    )
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    assert.equal(readFileSync(path, 'utf8'), `${own}\n${HISTORY_GITATTRIBUTES}`, 'added once')
  })

  test('git check-ignore -v lines name the rule and its source', () => {
    assert.deepEqual(parseCheckIgnore('.gitignore:3:*.log\tevals/.history/run/setup.log'), {
      path: 'evals/.history/run/setup.log',
      rule: '*.log',
      source: '.gitignore:3',
    })
    assert.equal(
      parseCheckIgnore('evals/.history/.gitignore:6:!*.log\tevals/.history/run/setup.log'),
      null,
      'a ! un-ignore is not an ignore',
    )
    assert.equal(parseCheckIgnore('not a check-ignore line'), null)
  })

  test('a history file that is not a readable record is named on stderr, not silently skipped', async () => {
    const p = await gitProject('record-unreadable', { 'evals/agent.eval.ts': agent })
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    const [good] = recordedRuns(p.dir)
    // What a merge that went wrong, or a copy cut short, leaves behind.
    const conflicted = `${HISTORY}/20260101T000000Z_deadbee_someone_aaaa.json`
    const truncated = `${HISTORY}/20260101T000001Z_deadbee_someone_bbbb.json`
    await writeFile(join(p.dir, conflicted), '<<<<<<< HEAD\n{"kind":"reeval-run"}\n=======\n')
    await writeFile(join(p.dir, truncated), '{"kind":"reeval-run","runId":"2026')
    for (const args of [['history'], ['history', '--json'], ['query', 'lift', '--rebuild']]) {
      const r = await runCli(p.dir, args)
      assert.equal(r.code, 0, `${args.join(' ')}: ${r.stderr}`)
      for (const file of [conflicted, truncated]) {
        const warning = `warning: skipped ${file}: not a readable reeval run record`
        assert.equal(
          r.stderr.split(warning).length - 1,
          1,
          `${args.join(' ')} names ${file} once:\n${r.stderr}`,
        )
      }
      // The canary: the readable run is still there.
      if (args[1] === '--json') assert.equal(JSON.parse(r.stdout).runs[0].runId, good)
    }
  })

  test("artifacts 'failures' keeps what a failed eval's compare input and lift gate need", async () => {
    const p = await fixture('features/compare/question-artifacts')
    await rm(join(p.dir, 'evals/lands.eval.ts'))
    await rm(join(p.dir, 'evals/canary.eval.ts'))
    await writeFile(
      join(p.dir, 'evals/mixed.eval.ts'),
      `import { defineEval, expect } from 'reeval'
import { baseline, variant } from './env.ts'

export default defineEval({
  runs: 2,
  compare: { control: baseline, variants: [variant] },
  questions: [{ question: 'Which page looks better?', across: 'environment', task: true, artifacts: ['landing'] }],
  async task(c) {
    await c.send('write the page')
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'aside' })
    await c.capture(server, { name: 'landing' })
    expect(c.attempt.n, 'first try').toBe(1)
  },
})
`,
    )
    await writeFile(
      join(p.dir, 'evals/flat.eval.ts'),
      `import { defineEval } from 'reeval'
import { baseline, variant } from './env.ts'

export default defineEval({
  compare: { control: baseline, variants: [variant], minLift: 0.5 },
  async task(c) {
    await c.send('write the page')
  },
})
`,
    )
    await writeFile(
      join(p.dir, 'evals/lifted.eval.ts'),
      `import { defineEval, expect } from 'reeval'
import { baseline, variant } from './env.ts'

export default defineEval({
  runs: 2,
  compare: { control: baseline, variants: [variant], minLift: 0.6 },
  async task(c) {
    await c.send('write the page')
    expect(c.attempt.cell.role === 'variant' || c.attempt.n === 1, 'passes').toBe(true)
  },
})
`,
    )
    assert.equal((await runCli(p.dir)).code, 1)
    const r = await runCli(p.dir, ['record', '--artifacts', 'failures'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const { run, dir } = readRun(p.dir, { history: HISTORY })
    const evalOf = (name: string) => run.evals.find((e) => e.name === name)
    const mixed = evalOf('mixed')
    assert.equal(mixed?.outcome, 'fail')
    const input = mixed?.answers?.[0]?.input
    assert.ok(input && existsSync(join(dir, input.path)), 'the failed eval keeps its compare input')
    const shots = JSON.parse(readFileSync(join(dir, input.path), 'utf8')).calls.flatMap(
      (c: { screenshots?: { path?: string }[] }) => c.screenshots ?? [],
    )
    assert.ok(shots.length > 0)
    for (const s of shots) assert.ok(s.path && existsSync(join(dir, s.path)), s.path)
    for (const a of mixed?.attempts ?? []) {
      const kept = Object.keys(a.files).sort()
      if (a.outcome === 'fail') assert.ok(a.files.transcript, `${a.id} keeps its transcript`)
      else {
        assert.deepEqual(kept, ['artifacts', 'diff'], `${a.id}: the shown capture and its diff`)
        assert.deepEqual(
          a.files.artifacts?.map((x) => x.name),
          ['landing'],
        )
      }
    }
    const flat = evalOf('flat')
    assert.equal(flat?.outcome, 'fail')
    assert.ok(
      flat?.attempts.every((a) => a.outcome === 'pass' && a.files.transcript),
      'a lift gate that failed with no failed attempt keeps every attempt',
    )
    const lifted = evalOf('lifted')
    const variantCell = lifted?.cells.find((c) => c.role === 'variant')
    assert.equal(variantCell?.outcome, 'fail', 'the variant misses its minLift')
    assert.ok(
      lifted?.attempts
        .filter((a) => a.cell === variantCell?.key)
        .every((a) => a.outcome === 'pass' && a.files.transcript),
      "the lift-failed cell keeps its attempts beside the control's failure",
    )
  })

  test("history.artifacts defaults to 'evidence': a passing attempt keeps diffs, not logs", async () => {
    const p = await gitProject('record-default-level', {
      'evals/passes.eval.ts': setUp('echo ok'),
      'evals/fails.eval.ts': setUp('exit 4'),
    })
    const ran = await runCli(p.dir)
    assert.equal(ran.code, 1, ran.stdout + ran.stderr)
    const r = await runCli(p.dir, ['record'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const { run, dir } = readRun(p.dir, { history: HISTORY })
    assert.equal(run.artifacts, 'evidence')
    const attempt = (name: string) => run.evals.find((e) => e.name === name)?.attempts[0]
    const fail = attempt('fails')
    assert.equal(fail?.outcome, 'fail')
    for (const ref of [fail?.files.setupLog, fail?.files.transcript, fail?.checks[0]?.log]) {
      assert.ok(ref && existsSync(join(dir, ref.path)), `the failed attempt keeps ${ref?.path}`)
    }
    const pass = attempt('passes')
    assert.equal(pass?.outcome, 'pass')
    // evidencePass: drop transcript/setup/check logs; keep diff/captures when present.
    assert.equal(pass?.files.transcript, undefined, 'no transcript for the passing attempt')
    assert.equal(pass?.files.setupLog, undefined, 'no setup.log for the passing attempt')
    assert.deepEqual(
      pass?.checks.map((c) => c.log),
      [undefined],
      'no c.exec log for the passing attempt',
    )
    if (pass?.files.diff) {
      assert.ok(existsSync(join(dir, pass.files.diff.path)), 'evidence may keep a passing diff')
    }
  })

  test("'failures' keeps a passing attempt's diff beside a failure of its own case only", async () => {
    const p = await gitProject('record-cases-diff', {
      'evals/cased.eval.ts': `import { defineEval, expect } from 'reeval'
export default defineEval({
  cases: ['a', 'b'],
  runs: 2,
  async task(c, k) {
    await c.send(k)
    expect(k === 'a' && c.attempt.n === 1, 'first a fails').toBe(false)
  },
})
`,
    })
    assert.equal((await runCli(p.dir)).code, 1)
    const r = await runCli(p.dir, ['record', '--artifacts', 'failures'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const { run } = readRun(p.dir, { history: HISTORY })
    const kept = run.evals[0]?.attempts.map((a) => [a.case, a.n, a.outcome, Object.keys(a.files)])
    assert.deepEqual(
      kept?.map(([k, n, outcome, files]) => [k, n, outcome, (files as string[]).includes('diff')]),
      [
        ['a', 1, 'fail', true],
        ['a', 2, 'pass', true],
        ['b', 1, 'pass', false],
        ['b', 2, 'pass', false],
      ],
    )
  })

  test('artifact levels, and config.record modes', async () => {
    const p = await gitProject(
      'record-levels',
      { 'evals/agent.eval.ts': agent, 'evals/broken.eval.ts': failing },
      `history: { artifacts: 'failures' }, record: 'always',`,
    )
    assert.equal((await runCli(p.dir)).code, 1)
    const recorded = readRun(p.dir, { history: HISTORY })
    assert.equal(recorded.run.artifacts, 'failures')
    const pass = recorded.evals.find((e) => e.outcome === 'pass')
    const fail = recorded.evals.find((e) => e.outcome === 'fail')
    assert.deepEqual(pass?.trial.files, {}, 'no artifacts for the passing eval')
    assert.ok(!existsSync(join(recorded.dir, pass?.slug ?? 'x')))
    assert.ok(
      fail?.trial.checks[0]?.log && existsSync(join(recorded.dir, fail.trial.checks[0].log.path)),
    )
    assert.ok(pass?.trial.judgements.length, 'verdicts stay in the record')

    const scratch = readRun(p.dir).run.runId
    await runCli(p.dir, ['run', 'agent.eval'])
    const again = await runCli(p.dir, ['record', scratch])
    assert.match(again.stdout, /already recorded/)
    const none = await runCli(p.dir, ['record', scratch, '--artifacts', 'none'])
    assert.equal(none.code, 2)
    assert.match(none.stderr, /already recorded with different content.*never rewritten/)

    const q = await gitProject('record-ci', { 'evals/agent.eval.ts': agent })
    assert.equal((await runCli(q.dir)).code, 0)
    const local = readRun(q.dir).run.runId
    assert.deepEqual(recordedRuns(q.dir), [], "record: 'ci' is the default, and this isn't CI")
    assert.equal((await runCli(q.dir, ['run'], { env: { CI: '1' } })).code, 0)
    const [ci] = recordedRuns(q.dir)
    assert.match(ci ?? '', /_ci_[0-9a-z]{4}$/)
    // By id: two runs in the same second sort by author, not start order.
    const bare = await runCli(q.dir, ['record', local, '--artifacts', 'none'])
    assert.equal(bare.code, 0, bare.stderr)
    const runs = recordedRuns(q.dir)
    assert.equal(runs.length, 2)
    assert.ok(!existsSync(join(q.dir, HISTORY, local)), 'no artifact dir with none')
  })

  test('two branches record, merge with zero conflicts, and old checkouts show old history', async () => {
    const p = await gitProject('record-merge', { 'evals/agent.eval.ts': agent })
    sh(p.dir, 'checkout', '-q', '-b', 'a')
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    sh(p.dir, 'add', '-A')
    sh(p.dir, 'commit', '-q', '-m', 'record on a')
    const onA = recordedRuns(p.dir)
    const commitA = sh(p.dir, 'rev-parse', 'HEAD')

    sh(p.dir, 'checkout', '-q', 'main')
    sh(p.dir, 'checkout', '-q', '-b', 'b')
    assert.deepEqual(recordedRuns(p.dir), [], "b doesn't see a's run")
    await writeFile(join(p.dir, 'evals/second.eval.ts'), agent)
    sh(p.dir, 'add', '-A')
    sh(p.dir, 'commit', '-q', '-m', 'add an eval')
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    sh(p.dir, 'add', '-A')
    sh(p.dir, 'commit', '-q', '-m', 'record on b')
    const onB = recordedRuns(p.dir)

    sh(p.dir, 'merge', '-q', '--no-edit', 'a')
    assert.equal(sh(p.dir, 'ls-files', '--unmerged'), '', 'zero conflicts')
    assert.equal(sh(p.dir, 'status', '--porcelain'), '')
    const merged = recordedRuns(p.dir)
    assert.deepEqual(merged, [...onA, ...onB].sort(), 'the union, in file-name order')
    const view = await historyJson(p.dir)
    assert.deepEqual(
      view.runs.map((r) => r.runId),
      merged,
    )
    assert.deepEqual(view.orphaned, [])
    const agentRow = view.rows.find((r) => r.id === 'agent')
    assert.deepEqual(agentRow?.outcomes, ['pass', 'pass', 'pass'])

    sh(p.dir, 'checkout', '-q', commitA)
    assert.deepEqual(
      (await historyJson(p.dir)).runs.map((r) => r.runId),
      onA,
      'an old commit shows the history as it was',
    )
    sh(p.dir, 'checkout', '-q', 'b')
    assert.equal((await historyJson(p.dir)).runs.length, 3, 'the cache follows the checkout')
  })

  test('runs recorded before a rebase are flagged but still compared', async () => {
    const p = await gitProject('record-rebase', { 'evals/agent.eval.ts': agent })
    sh(p.dir, 'checkout', '-q', '-b', 'feature')
    await writeFile(join(p.dir, 'feature.txt'), 'x\n')
    sh(p.dir, 'add', '-A')
    sh(p.dir, 'commit', '-q', '-m', 'feature work')
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    const [before] = recordedRuns(p.dir)
    sh(p.dir, 'add', '-A')
    sh(p.dir, 'commit', '-q', '-m', 'record')

    sh(p.dir, 'checkout', '-q', 'main')
    await writeFile(join(p.dir, 'main.txt'), 'y\n')
    sh(p.dir, 'add', '-A')
    sh(p.dir, 'commit', '-q', '-m', 'main moves on')
    sh(p.dir, 'checkout', '-q', 'feature')
    sh(p.dir, 'rebase', '-q', 'main')

    const view = await historyJson(p.dir)
    assert.deepEqual(view.orphaned, [before], 'its commit was rewritten')
    const text = await runCli(p.dir, ['history'])
    assert.match(text.stdout, /1 run was recorded on commits that aren't in HEAD's history/)

    assert.equal((await runCli(p.dir)).code, 0)
    const cmp = await runCli(p.dir, ['compare', '--json'])
    assert.equal(cmp.code, 0, cmp.stderr)
    const result = JSON.parse(cmp.stdout)
    assert.equal(result.base.runId, before)
    assert.equal(result.base.inHistory, false)
    assert.equal(result.head.recorded, false)
    assert.deepEqual(
      result.rows.map((r: { status: string }) => r.status),
      ['same'],
    )
    const md = await runCli(p.dir, ['compare', '--md'])
    // compare --md is RunReport with prior; orphaned-base text stays on the plain compare layout.
    assert.match(md.stdout, new RegExp(`Changes since .*${before}`))
    assert.match(md.stdout, /Unchanged \(1\)/)
  })

  test('runs further back than the first 20,000 commits are still in HEAD’s history', async () => {
    const p = await gitProject('record-deep', { 'evals/agent.eval.ts': agent })
    const commit = async (name: string) => {
      await writeFile(join(p.dir, `${name}.txt`), 'x\n')
      sh(p.dir, 'add', `${name}.txt`)
      sh(p.dir, 'commit', '-q', '-m', name)
      return sh(p.dir, 'rev-parse', 'HEAD')
    }
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    const second = await commit('second')
    await commit('third')
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    // A later run on `second`: its base is the run on the first commit, not the one on `third`.
    sh(p.dir, 'checkout', '-q', second)
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    // The canary: a run on a commit no branch keeps is still flagged.
    await commit('dropped')
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    sh(p.dir, 'checkout', '-q', 'main')
    const [onFirst, onThird, head, onDropped] = recordedRuns(p.dir)
    const parent = sh(p.dir, 'rev-parse', 'HEAD')
    let stream = ''
    for (let i = 1; i <= 20_001; i++) {
      stream += `commit refs/heads/main\ncommitter t <t@example.com> ${1_700_000_000 + i} +0000\n`
      stream += `data ${String(i).length}\n${i}\n${i === 1 ? `from ${parent}\n` : ''}\n`
    }
    execFileSync('git', ['fast-import', '--quiet'], { cwd: p.dir, input: stream, env: GIT_ENV })
    sh(p.dir, 'reset', '-q', '--hard', 'main')

    assert.equal(sh(p.dir, 'rev-list', '--count', 'HEAD'), '20004')

    assert.deepEqual(
      (await historyJson(p.dir)).orphaned,
      [onDropped],
      'the others are ancestors of HEAD',
    )

    const cmp = await runCli(p.dir, ['compare', '--json', head ?? ''])
    assert.equal(cmp.code, 0, cmp.stderr)
    const result = JSON.parse(cmp.stdout)
    assert.equal(result.base.runId, onFirst, `not ${onThird}, a commit after head's`)
    assert.equal(result.base.inHistory, true)
    assert.equal(result.head.inHistory, true)
    const two = await runCli(p.dir, ['compare', '--json', onFirst ?? '', onDropped ?? ''])
    assert.deepEqual(
      [JSON.parse(two.stdout).base.inHistory, JSON.parse(two.stdout).head.inHistory],
      [true, false],
    )

    const analyze = await runCli(p.dir, ['analyze', head ?? '', '--dry-run'])
    assert.equal(analyze.code, 0, analyze.stderr)
    assert.match(analyze.stdout, new RegExp(`^digest ${head} vs ${onFirst}:`))
  })

  test('recording refuses files that look like secrets, or that changed after the run', async () => {
    const leaked = 'totally-private-value-4242'
    const p = await gitProject('record-secret', { 'evals/agent.eval.ts': agent })
    await writeFile(
      join(p.dir, 'reeval.config.ts'),
      fakeConfig({ harness: harness(`Used ${leaked}`) }),
    )
    sh(p.dir, 'commit', '-qam', 'config')
    assert.equal((await runCli(p.dir)).code, 0)
    // A token that wasn't in the environment during the run, but is now.
    const r = await runCli(p.dir, ['record', '--artifacts', 'all'], {
      env: { DEPLOY_TOKEN: leaked },
    })
    assert.equal(r.code, 2)
    assert.match(r.stderr, /Refusing to record .*look like they contain a secret/s)
    assert.match(r.stderr, /\/transcript\.jsonl line \d+: the value of DEPLOY_TOKEN$/m)
    assert.doesNotMatch(r.stderr, new RegExp(leaked), 'names files, not the secret')
    assert.doesNotMatch(r.stderr, new RegExp(leaked.slice(0, 4)), 'no part of a known value')
    assert.deepEqual(recordedRuns(p.dir), [])

    const { dir, evals } = readRun(p.dir)
    await appendFile(join(dir, evals[0]?.trial.files.transcript?.path ?? ''), 'edited\n')
    const tampered = await runCli(p.dir, ['record', '--artifacts', 'all'])
    assert.equal(tampered.code, 2)
    assert.match(tampered.stderr, /changed since the run wrote it/)

    const scan = readdirSync(join(p.dir, '.reeval/runs'), { recursive: true, withFileTypes: true })
      .filter((f) => f.isFile())
      .map((f) => readFileSync(join(f.parentPath, f.name), 'utf8'))
    assert.ok(
      scan.some((text) => text.includes(leaked)),
      'the scratch run still has it, locally',
    )
  })

  test('a dirty run saves worktree.patch, lockfile hashes and state; reeval checkout reproduces it', async () => {
    const p = await gitProject('record-state', {
      'evals/agent.eval.ts': agent,
      'package-lock.json': '{"lockfileVersion":3}\n',
      'src/app.js': 'export const v = 1\n',
    })
    await writeFile(join(p.dir, 'src/app.js'), 'export const v = 2\n')
    await writeFile(join(p.dir, 'src/new.js'), 'export const added = true\n')
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    const { run, read } = readRun(p.dir, { history: HISTORY })
    assert.equal(run.git?.dirty, true)
    assert.equal(run.git?.sha, sh(p.dir, 'rev-parse', 'HEAD'), 'the commit the run executed at')
    const patch = read('worktree.patch')
    assert.match(patch, /\+export const v = 2/)
    assert.match(patch, /src\/new\.js/, 'untracked files are included')
    assert.doesNotMatch(patch, /evals\/\.history|\.reeval\//, "reeval's own output is not")
    assert.equal(run.git?.worktreePatch?.sha256, run.git?.diffHash)
    assert.deepEqual(
      run.dependencies.lockfiles.map((l) => l.path),
      ['package-lock.json'],
    )
    assert.deepEqual(run.stack.images, [])
    assert.equal(run.stack.node, process.versions.node)
    assert.deepEqual(run.stack.runtime, { name: 'node', version: process.versions.node })
    assert.deepEqual(run.stack.language, { name: 'typescript' })
    assert.ok(
      run.stack.packages.ai && run.stack.packages['@vitest/expect'] && run.stack.packages.jiti,
    )
    assert.match(run.stack.judge.version, /^[0-9a-f]{12}$/)
    assert.equal('reproducibility' in run, false)
    assert.deepEqual(run.stack.fingerprintScope.length > 0, true)
    assert.equal('fixtureHash' in (run.evals[0] ?? {}), false)
    assert.equal(sh(p.dir, 'diff', '--cached', '--name-only'), '', "the user's index is untouched")

    const shown = await runCli(p.dir, ['show', 'latest'])
    assert.match(
      shown.stdout,
      /Executed at +[0-9a-f]{12} on main, dirty \(the commit that adds this record is later\)/,
    )
    assert.match(shown.stdout, /Uncommitted +worktree\.patch, \d+ bytes/)
    assert.match(shown.stdout, /Lockfiles +package-lock\.json [0-9a-f]{12}/)
    assert.match(
      shown.stdout,
      new RegExp(`reeval +\\S+ · node ${process.versions.node} · typescript evals · `),
    )
    assert.doesNotMatch(shown.stdout, /!|not reproducible/, 'no warning when everything is saved')
    assert.match(read('summary.md'), /## State[\s\S]*\| Uncommitted \| worktree\.patch/)

    const target = join(tempDir('record-state-checkout'), 'tree')
    const co = await runCli(p.dir, ['checkout', 'latest', target])
    assert.equal(co.code, 0, co.stderr)
    assert.match(co.stdout, /applied worktree\.patch/)
    assert.equal(readFileSync(join(target, 'src/app.js'), 'utf8'), 'export const v = 2\n')
    assert.equal(readFileSync(join(target, 'src/new.js'), 'utf8'), 'export const added = true\n')
    sh(p.dir, 'worktree', 'remove', '--force', target)
  })

  test("a profile's judge is the judge the record names and fingerprints", async () => {
    const withProfile = await project('record-profile-judge', {
      'evals/agent.eval.ts': agent,
      'reeval.config.ts': fakeConfig({
        harness: harness(),
        judge: `{ model: 'google/gemini-2.5-flash', threshold: 0.5 }`,
        extra: `profiles: {
    ci: { judge: { model: fakeJudge({ score: 0.9 }) }, defaults: { judge: { threshold: 0.8 } } },
  },`,
      }),
    })
    const r = await runCli(withProfile.dir, ['run', '--profile', 'ci'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const { run } = readRun(withProfile.dir)
    assert.equal(run.evals[0]?.attempts[0]?.judgements[0]?.threshold, 0.8, 'the profile judged')
    assert.deepEqual(
      { model: run.stack.judge.model, threshold: run.stack.judge.threshold },
      { model: 'fake', threshold: 0.8 },
    )
    assert.deepEqual(
      { model: run.config.judgeModel, threshold: run.config.threshold },
      { model: 'fake', threshold: 0.8 },
    )

    const direct = await project('record-config-judge', {
      'evals/agent.eval.ts': agent,
      'reeval.config.ts': fakeConfig({
        harness: harness(),
        judge: '{ model: fakeJudge({ score: 0.9 }), threshold: 0.8 }',
      }),
    })
    assert.equal((await runCli(direct.dir)).code, 0)
    const same = readRun(direct.dir).run
    assert.equal(run.stack.judge.version, same.stack.judge.version)
    assert.equal(
      run.evals[0]?.cells[0]?.fingerprintParts.judge,
      same.evals[0]?.cells[0]?.fingerprintParts.judge,
      'the same judge is the same measurement, however it was chosen',
    )
  })

  test("a profile's defaults.sandbox is the sandbox the run header and the record name", async () => {
    const p = await project('record-profile-sandbox', {
      'evals/agent.eval.ts': agent,
      'reeval.config.ts': fakeConfig({
        harness: harness(),
        extra: 'profiles: { fake: { defaults: { sandbox } } },',
      })
        .replace(
          "import { fakeSandbox } from 'reeval/sandbox'",
          "import { docker, fakeSandbox } from 'reeval/sandbox'",
        )
        .replace('  sandbox,\n', '  sandbox: docker(),\n'),
    })
    const r = await runCli(p.dir, ['run', '--profile', 'fake', '--ui', 'plain'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /^ {2}➜ {2}Harness: +fake\n {2}➜ {2}Sandbox: +fake$/m)
    const { run } = readRun(p.dir)
    assert.equal(run.evals[0]?.cells[0]?.sandbox, 'fake', 'the cell ran on the fake sandbox')
    assert.equal(run.config.sandbox, 'fake')
    assert.equal(run.profile?.defaults.sandbox, 'fake')
  })

  test("the config's judge names no inputs, so the record's stack has no judge.state", async () => {
    const p = await project('state-none', {
      'evals/agent.eval.ts': agent,
      'reeval.config.ts': fakeConfig({ harness: harness() }),
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const { run } = readRun(p.dir)
    assert.equal(run.stack.judge.state, undefined)
    assert.ok(run.evals[0]?.cells[0]?.fingerprintParts.judge)
  })

  test("the cell's gateway is in the record, and direct leaves the fingerprint as it was", async () => {
    const run = async (name: string, gateway?: string) => {
      const p = await project(name, {
        'evals/agent.eval.ts': agent,
        'reeval.config.ts': `import { direct, vercel } from 'reeval/gateway'
${fakeConfig({ harness: harness(), ...(gateway ? { extra: `gateway: ${gateway},` } : {}) })}`,
      })
      const r = await runCli(p.dir)
      assert.equal(r.code, 0, r.stdout + r.stderr)
      return readRun(p.dir).run.evals[0]?.cells[0]
    }
    const unset = await run('gateway-unset')
    const direct = await run('gateway-direct', '[direct()]')
    assert.equal(unset?.gateway, undefined)
    assert.equal(direct?.gateway, 'direct')
    assert.equal(direct?.fingerprintParts.gateway, undefined)
    assert.equal(direct?.fingerprint, unset?.fingerprint, 'direct() is the default')
    const vercel = await run('gateway-vercel', '[vercel()]')
    assert.equal(vercel?.gateway, 'vercel')
    assert.equal(vercel?.fingerprintParts.gateway, 'vercel')
    assert.equal(vercel?.fingerprintParts.harness, unset?.fingerprintParts.harness)
    assert.notEqual(vercel?.fingerprint, unset?.fingerprint, 'another route is another measurement')
  })

  test('a project reached through another spelling of its path records like any other', async () => {
    // A symlink here; on Windows an 8.3 short name (C:\\Users\\RUNNER~1). git reports its top
    // level canonically, so paths reeval works out against it must be spelled from the project's root.
    const p = await gitProject('record-symlink', {
      'evals/agent.eval.ts': agent,
      'package-lock.json': '{"lockfileVersion":3}\n',
    })
    const link = join(tempDir('record-symlink-link'), 'project')
    symlinkSync(p.dir, link, 'junction')
    // Through --config: a symlinked cwd would be resolved by the OS.
    const config = ['--config', join(link, 'reeval.config.ts')]
    for (let i = 0; i < 2; i++) {
      const clean = await runCli(p.dir, ['run', '--record', ...config])
      assert.equal(clean.code, 0, clean.stdout + clean.stderr)
      const { git } = readRun(link, { history: HISTORY }).run
      assert.equal(git?.dirty, false, 'its own history is not a change')
    }
    await writeFile(join(link, 'app.js'), 'export const v = 2\n')
    assert.equal((await runCli(p.dir, ['run', '--record', ...config])).code, 0)
    const { run, read } = readRun(link, { history: HISTORY })
    assert.equal(run.git?.dirty, true)
    assert.match(read('worktree.patch'), /\+export const v = 2/)
    assert.doesNotMatch(read('worktree.patch'), /evals\/\.history/)
    assert.deepEqual(
      run.dependencies.lockfiles.map((l) => l.path),
      ['package-lock.json'],
    )
  })

  test('paths print from the current directory when the config is reached through a symlink', async () => {
    // As on macOS, where the temp dir is /var/… and the current directory /private/var/….
    const p = await gitProject('display-symlink', { 'evals/agent.eval.ts': agent })
    const link = join(tempDir('display-symlink-link'), 'project')
    symlinkSync(p.dir, link, 'junction')
    const r = await runCli(p.dir, ['run', '--record', '--config', join(link, 'reeval.config.ts')])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.match(r.stdout, / · summary \.reeval\/runs\/\S+\/summary\.md$/m)
    assert.match(r.stdout, /^recorded evals\/\.history\/\S+\.json/m)
    assert.doesNotMatch(r.stdout + r.stderr, /\.\.\//)
  })

  test('a secret in the uncommitted changes records the run without worktree.patch, and says where', async () => {
    const key = `AIza${'Q'.repeat(31)}WXYZ`
    const p = await gitProject('record-patch-secret', { 'evals/agent.eval.ts': agent })
    await writeFile(join(p.dir, '.env.example'), `# keys\nCURSOR_API_KEY=\nGEMINI_API_KEY=${key}\n`)
    assert.equal((await runCli(p.dir)).code, 0)
    const r = await runCli(p.dir, ['record'])
    assert.equal(r.code, 0, r.stderr)
    assert.match(
      r.stdout,
      /^warning: left worktree\.patch out of \S+: it looks like it holds a secret\.$/m,
    )
    assert.match(
      r.stdout,
      /^ {2}worktree\.patch: \.env\.example line 3: Google API key \(AIza…WXYZ\)$/m,
    )
    assert.match(
      r.stdout,
      /uncommitted changes when the run started \(git status\), not the agents' work/,
    )
    assert.match(r.stdout, /--skip-secret-scan\.$/m)
    assert.match(
      r.stdout,
      /Nothing was committed\. Take the key out of those files, or add them to \.gitignore/,
    )
    assert.match(r.stdout, /rotate the key only if it's already been committed or pushed/)
    assert.doesNotMatch(r.stdout, /rotate it/)
    assert.match(r.stdout, /^recorded evals\/\.history\/\S+\.json/m)
    assert.doesNotMatch(r.stdout, new RegExp(key))

    const [runId] = recordedRuns(p.dir)
    const historyDir = join(p.dir, 'evals/.history')
    const record = JSON.parse(readFileSync(join(historyDir, `${runId}.json`), 'utf8'))
    assert.equal(record.git.dirty, true)
    assert.equal(record.git.worktreePatch, null)
    assert.equal(
      record.git.worktreePatchNote,
      'not kept: it looked like it held a secret (.env.example line 3: Google API key)',
    )
    assert.ok(record.git.diffHash, 'the hash of the changes is still recorded')
    const runDir = join(historyDir, runId as string)
    assert.ok(!existsSync(join(runDir, 'worktree.patch')))
    assert.match(readFileSync(join(runDir, 'summary.md'), 'utf8'), /not saved: not kept: it looked/)

    const show = await runCli(p.dir, ['show'])
    assert.match(
      show.stdout,
      /Uncommitted changes weren't saved \(not kept: it looked like it held a secret/,
    )
    const target = join(tempDir('record-patch-secret-checkout'), 'tree')
    const co = await runCli(p.dir, ['checkout', 'latest', target])
    assert.equal(co.code, 0, co.stderr)
    assert.match(
      co.stdout,
      /^checked out \w{12} into \S+, without the run's uncommitted changes: they weren't saved \(not kept: it looked like it held a secret \(\.env\.example line 3: Google API key\)\)\.$/m,
    )
    assert.ok(!existsSync(join(target, '.env.example')))
  })

  test('--skip-secret-scan keeps a worktree.patch that looks like it holds a secret', async () => {
    const p = await gitProject('record-patch-skip', { 'evals/agent.eval.ts': agent })
    await writeFile(join(p.dir, 'config.js'), `export const key = 'AIza${'Q'.repeat(35)}'\n`)
    assert.equal((await runCli(p.dir)).code, 0)
    const r = await runCli(p.dir, ['record', '--skip-secret-scan'])
    assert.equal(r.code, 0, r.stderr)
    assert.doesNotMatch(r.stdout, /warning/)
    const [runId] = recordedRuns(p.dir)
    const runDir = join(p.dir, 'evals/.history', runId as string)
    assert.ok(existsSync(join(runDir, 'worktree.patch')))
  })

  test('reeval checkout stops before making a worktree when the recorded worktree.patch is gone', async () => {
    const p = await gitProject('record-patch-missing', { 'evals/agent.eval.ts': agent })
    await writeFile(join(p.dir, 'notes.txt'), 'uncommitted\n')
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    const [runId] = recordedRuns(p.dir)
    const runDir = join(p.dir, 'evals/.history', runId as string)
    await rm(join(runDir, 'worktree.patch'))
    const target = join(tempDir('record-patch-missing-checkout'), 'tree')
    const co = await runCli(p.dir, ['checkout', 'latest', target])
    assert.equal(co.code, 2)
    assert.match(
      co.stderr,
      /worktree\.patch is missing, but the record says the run's uncommitted changes are in it\. Restore it from git/,
    )
    assert.ok(!existsSync(target), 'no worktree is left behind')
  })
})
