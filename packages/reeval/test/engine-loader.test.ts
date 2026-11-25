// Finding eval files (engine/files.ts) and loading them (engine/loader.ts): TypeScript, ESM and
// CommonJS mixes through jiti, tsconfig checks, and stacks mapped back to the sources.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { describe, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import {
  filterFiles,
  findEvalFiles,
  isPathPart,
  matchesCell,
  matchesEvalId,
  matchesFilter,
} from '../src/engine/files.ts'
import {
  checkTsconfig,
  loadEvalFile,
  originalStack,
  originalText,
  stripJsonComments,
  syntaxError,
  TsconfigError,
} from '../src/engine/loader.ts'
import { tempDir } from './helpers.ts'

function tree(files: Record<string, string>): string {
  const root = tempDir('loader')
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return root
}

/** `path` as a pattern: frames of transformed files say C:/… on Windows, others C:\\…. */
const pathRe = (path: string) =>
  path
    .split(/[\\/]/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\\\/]')

describe('findEvalFiles and filterFiles', () => {
  test('globs include minus exclude, dotfiles included, sorted and absolute', async () => {
    const root = tree({
      'evals/b.eval.ts': '',
      'evals/a.eval.ts': '',
      'evals/.hidden/c.eval.ts': '',
      'evals/.history/old.eval.ts': '',
      'node_modules/x/evals/d.eval.ts': '',
      'other.ts': '',
    })
    const files = await findEvalFiles(
      root,
      ['**/*.eval.ts'],
      ['**/node_modules/**', 'evals/.history/**'],
    )
    assert.deepEqual(
      files.map((f) => relative(root, f).split(sep).join('/')),
      ['evals/.hidden/c.eval.ts', 'evals/a.eval.ts', 'evals/b.eval.ts'],
    )
  })

  test('a path part on disk picks the files under it; an eval file name matches at a segment boundary', () => {
    const root = realpathSync(tempDir('filter-files'))
    const rels = [
      'evals/Greet.eval.ts',
      'evals/skill/add.eval.ts',
      'evals/skills-old/old.eval.ts',
      'evals/sub/skill.eval.ts',
      'other/badd.eval.ts',
      'other/x.eval.ts',
    ]
    for (const rel of rels) {
      mkdirSync(dirname(join(root, rel)), { recursive: true })
      writeFileSync(join(root, rel), '')
    }
    const files = rels.map((rel) => join(root, rel))
    const pick = (...filters: string[]) =>
      filterFiles(files, filters, root).map((file) => relative(root, file).split(sep).join('/'))
    const cwd = process.cwd()
    process.chdir(root)
    try {
      assert.deepEqual(pick(), rels)
      assert.deepEqual(pick('evals/skill'), ['evals/skill/add.eval.ts'])
      assert.deepEqual(pick('evals/sub/'), ['evals/sub/skill.eval.ts'])
      assert.deepEqual(pick(join(root, 'evals/sub')), ['evals/sub/skill.eval.ts'])
      assert.deepEqual(pick(join(root, 'evals/skill/add.eval')), ['evals/skill/add.eval.ts'])
      assert.deepEqual(pick(join(root, 'nowhere')), [])
      assert.deepEqual(pick('add.eval'), ['evals/skill/add.eval.ts'])
      assert.deepEqual(pick('skill/add.eval.ts'), ['evals/skill/add.eval.ts'])
      assert.deepEqual(pick('evals\\skill\\add.eval.ts'), ['evals/skill/add.eval.ts'])
      assert.deepEqual(pick('greet.eval'), ['evals/Greet.eval.ts'])
      assert.deepEqual(pick('nope', 'x.eval'), ['other/x.eval.ts'])
      assert.deepEqual(pick('skill'), [])
      process.chdir(join(root, 'evals'))
      assert.deepEqual(pick('sub'), ['evals/sub/skill.eval.ts'])
      assert.deepEqual(pick('evals/sub'), [])
    } finally {
      process.chdir(cwd)
    }
    assert.equal(isPathPart('add.eval'), true)
    assert.equal(isPathPart('a/b.eval.py'), true)
    assert.equal(isPathPart('no-such-dir'), false)
  })

  test('a name filter matches an eval id by exact match, segment prefix, glob or #case', () => {
    assert.equal(matchesEvalId('foo/bar', 'foo/bar'), true)
    assert.equal(matchesEvalId('foo/bar/baz', 'foo/bar'), true)
    assert.equal(matchesEvalId('foo/bar/baz', 'foo/bar/'), true)
    assert.equal(matchesEvalId('good/child', 'good/'), true)
    assert.equal(matchesEvalId('good/child', 'good'), true)
    assert.equal(matchesEvalId('foo/bigger', 'foo/big'), false)
    assert.equal(matchesEvalId('slow/bigger', 'slow/big'), false)
    assert.equal(matchesEvalId('rated#b', 'rated#b'), true)
    assert.equal(matchesEvalId('rated#b', 'rated#c'), false)
    assert.equal(matchesEvalId('skill/add#x', 'skill/add#xy'), false)
    assert.equal(matchesEvalId('evals/a.eval.ts › rated [b]', 'rated'), true)
    assert.equal(matchesEvalId('evals/a.eval.ts › rated [b]', 'rated/'), true)
    assert.equal(matchesEvalId('evals/tree.eval.ts › good › child', 'good/'), true)
    assert.equal(matchesEvalId('skill', 'skills-old/old'), false)
    assert.equal(matchesEvalId('skill/add', 'skill/ad'), false)
    assert.equal(matchesEvalId('slow/big', 'slow/big*'), true)
    assert.equal(matchesFilter({ id: 'foo/bar' }, 'foo'), true)
    assert.equal(matchesFilter({ id: 'x' }, 'h/skill/s'), false, 'a cell key is not an id')
  })

  test('--cell matches a cell key or cell#n exactly', () => {
    const attempt = { cell: { key: 'fake/-/fake' }, n: 2 }
    assert.equal(matchesCell(attempt, 'fake/-/fake'), true)
    assert.equal(matchesCell(attempt, 'fake/-/fake#2'), true)
    assert.equal(matchesCell(attempt, 'fake#2'), false)
    assert.equal(matchesCell(undefined, 'fake'), false)
  })
})

describe('loadEvalFile', () => {
  test('TypeScript, ESM, CommonJS, JSON, .mts and .cts, extensionless and circular imports, top-level await', async () => {
    const root = tree({
      'evals/main.eval.ts': `import { a, fromB } from './circ-a'
import cjs, { named } from './lib.cjs'
import data from './data.json'
import { m } from './mod.mts'
import c from './cmod.cts'
import { createRequire } from 'node:module'
enum Color { Red = 1 }
const req = createRequire(import.meta.url)
const waited = await new Promise((r) => setTimeout(() => r('tla'), 5))
export const out = { a, fromB: fromB(), cjs, named, data, m, c, waited, req: req('./lib.cjs').named, color: Color.Red, url: import.meta.url.startsWith('file:') }
`,
      'evals/circ-a.ts':
        "import { b } from './circ-b'\nexport const a = 'A'\nexport function fromB() { return b() }\n",
      'evals/circ-b.ts':
        "import { a } from './circ-a'\nexport function b() { return 'B sees ' + a }\n",
      'evals/lib.cjs': "module.exports = { named: 'N', kind: 'cjs' }\n",
      'evals/data.json': '{ "k": 1 }\n',
      'evals/mod.mts': "export const m: string = 'mts'\n",
      'evals/cmod.cts':
        "const sync: string = require('./required.ts').value\nexport = 'cts' + sync.length\n",
      'evals/required.ts': "export const value: string = ''\n",
    })
    const loaded = (await loadEvalFile(join(root, 'evals/main.eval.ts'), root)) as { out: unknown }
    assert.deepEqual(loaded.out, {
      a: 'A',
      fromB: 'B sees A',
      cjs: { named: 'N', kind: 'cjs' },
      named: 'N',
      data: { k: 1 },
      m: 'mts',
      c: 'cts0',
      waited: 'tla',
      req: 'N',
      color: 1,
      url: true,
    })
  })

  test("tsconfig paths don't resolve, as under Vite: the import fails loudly", async () => {
    const root = tree({
      'tsconfig.json':
        '{ "compilerOptions": { "baseUrl": ".", "paths": { "@lib/*": ["src/*"] } } }',
      'src/lib.ts': 'export const lib = 1\n',
      'evals/p.eval.ts': "import { lib } from '@lib/lib'\nexport { lib }\n",
    })
    await assert.rejects(loadEvalFile(join(root, 'evals/p.eval.ts'), root), /@lib\/lib/)
  })

  test('a syntax error names the file and position, with a code frame', async () => {
    const root = tree({ 'evals/bad.eval.ts': "const x = 1\nevaluate('f' async () => {})\n" })
    await assert.rejects(loadEvalFile(join(root, 'evals/bad.eval.ts'), root), (error: Error) => {
      assert.equal(error.name, 'SyntaxError')
      assert.match(
        error.message,
        /^Unexpected token, expected "," \(evals\/bad\.eval\.ts:2:14\)\n {2}1\| const x = 1\n/,
      )
      return true
    })
    // Anything else passes through unchanged.
    await assert.rejects(
      loadEvalFile(join(root, 'evals/missing.eval.ts'), root),
      (e: Error) => e.name !== 'SyntaxError',
    )
  })

  test("a missing import reads as Vite's did: which module, imported from where", async () => {
    const root = tree({
      'evals/m.eval.ts': "import './nope.ts'\n",
      'evals/throws.eval.ts':
        "throw Object.assign(new Error('odd'), { code: 'MODULE_NOT_FOUND' })\n",
    })
    await assert.rejects(
      loadEvalFile(join(root, 'evals/m.eval.ts'), root),
      (e: Error) =>
        e.message ===
        `Cannot find module './nope.ts' imported from ${join(root, 'evals/m.eval.ts')}`,
    )
    await assert.rejects(loadEvalFile(join(root, 'evals/throws.eval.ts'), root), /^Error: odd$/)
    const other = tree({ 'evals/nothing.eval.ts': 'throw undefined\n' })
    await assert.rejects(
      loadEvalFile(join(other, 'evals/nothing.eval.ts'), other),
      (e) => e === undefined,
    )
  })

  test("loading leaves Error.prepareStackTrace as it was: Babel's hook breaks Bun's", () => {
    // Babel installs its hook once per process, so this needs a process where nothing has loaded.
    const root = tree({ 'evals/x.eval.ts': 'export const x: number = 1\n' })
    const loader = pathToFileURL(join(import.meta.dirname, '../src/engine/loader.ts')).href
    const script = `import { loadEvalFile } from ${JSON.stringify(loader)}
const own = () => 'own'
Error.prepareStackTrace = own
await loadEvalFile(${JSON.stringify(join(root, 'evals/x.eval.ts'))}, ${JSON.stringify(root)})
process.stdout.write(String(Error.prepareStackTrace === own))`
    const r = spawnSync(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', script],
      { encoding: 'utf8', timeout: 60_000 },
    )
    assert.equal(r.stderr, '')
    assert.equal(r.status, 0)
    assert.equal(r.stdout, 'true')
  })

  test('syntaxError reads only jiti parse errors, and still reports one whose file is gone', () => {
    assert.equal(syntaxError(new Error('other'), '/'), undefined)
    assert.equal(syntaxError(undefined, '/'), undefined)
    const gone = syntaxError(new Error('ParseError: Bad  \n /nowhere/x.ts:3:0'), '/nowhere')
    assert.equal(gone?.message, 'Bad (x.ts:3:1)')
  })
})

describe('checkTsconfig', () => {
  test('no tsconfig, or valid JSON with comments and trailing commas, passes', () => {
    checkTsconfig(tree({ 'a/x.ts': '' }), '/')
    const root = tree({
      'tsconfig.json':
        '{\n  // strict\n  "compilerOptions": { "strict": true, /* on */ },\n  "include": ["**/*.ts",],\n}\n',
    })
    checkTsconfig(root, root)
  })

  test('a tsconfig saved with a UTF-8 BOM passes, as tsc reads it', () => {
    const root = tree({
      'tsconfig.json': '\uFEFF{ "extends": "./base.json" }',
      'base.json': '\uFEFF{ "compilerOptions": { "strict": true } }',
    })
    checkTsconfig(root, root)
  })

  test('a tsconfig that extends a missing file fails, naming it', () => {
    const root = tree({ 'tsconfig.json': '{ "extends": "../../tsconfig.base.json" }' })
    assert.throws(
      () => checkTsconfig(root, root),
      (e: Error) =>
        e instanceof TsconfigError &&
        e.message === "Failed to load tsconfig '../../tsconfig.base.json': Tsconfig not found",
    )
  })

  test("a tsconfig that isn't JSON fails, naming it and why", () => {
    const root = tree({ 'tsconfig.json': '{ bad json' })
    assert.throws(
      () => checkTsconfig(join(root), root),
      /^TsconfigError: Failed to load tsconfig 'tsconfig\.json': Expected property name/,
    )
  })

  test('any other tsconfig error fails too', () => {
    const root = tree({ 'tsconfig.json': '{ "extends": 5 }' })
    assert.throws(() => checkTsconfig(root, root), /^TsconfigError: Failed to load tsconfig: /)
  })

  test('stripJsonComments leaves strings alone', () => {
    const text = String.raw`{ "a": "x // y", "b": "q\"/*" /* c */, "c": [1,], } // end`
    assert.deepEqual(JSON.parse(stripJsonComments(text)), { a: 'x // y', b: 'q"/*', c: [1] })
    assert.equal(stripJsonComments('1 /* open'), '1  ')
    assert.equal(stripJsonComments('"unterminated'), '"unterminated')
  })
})

describe('originalStack', () => {
  test("frames in files jiti transformed point at the source, calls at the callee's name", async () => {
    const root = tree({
      'evals/helper.ts':
        'type T = { a: number }\nexport function boom(): never {\n  throw new Error("boom")\n}\n',
      'evals/main.ts': `import { boom } from './helper'
export function run(): void {
  const t: { n: number } = { n: 1 }
  void t
  boom()
}
`,
    })
    const { run } = (await loadEvalFile(join(root, 'evals/main.ts'), root)) as { run: () => void }
    let stack = ''
    try {
      run()
    } catch (error) {
      stack = originalStack((error as Error).stack ?? '')
    }
    assert.match(stack, new RegExp(`at boom \\(${pathRe(join(root, 'evals/helper.ts'))}:3:9\\)`))
    assert.match(stack, new RegExp(`at run \\(${pathRe(join(root, 'evals/main.ts'))}:5:3\\)`))
    // Edited since it loaded, down to one line: the position is kept as mapped.
    writeFileSync(join(root, 'evals/helper.ts'), '// gone\n')
    let again = ''
    try {
      run()
    } catch (error) {
      again = originalStack((error as Error).stack ?? '')
    }
    assert.match(again, new RegExp(`at boom \\(${pathRe(join(root, 'evals/helper.ts'))}:3:9\\)`))
  })

  test('other frames, unmapped positions and line 1 are handled', async () => {
    const root = tree({ 'evals/one.ts': 'export const f = () => { throw new Error("x") }\n' })
    const file = join(root, 'evals/one.ts')
    const { f } = (await loadEvalFile(file, root)) as { f: () => void }
    let raw = ''
    try {
      f()
    } catch (error) {
      raw = (error as Error).stack ?? ''
    }
    assert.match(originalStack(raw), new RegExp(`${pathRe(file)}:1:32`))
    assert.equal(originalStack('    at x (/elsewhere.js:1:1)'), '    at x (/elsewhere.js:1:1)')
    assert.equal(originalStack(`    at ${file}:999:1`), `    at ${file}:999:1`)
    assert.equal(originalStack(`    at ${file}:1:3`), `    at ${file}:1:3`, "in jiti's wrapper")
    rmSync(file)
    writeFileSync(file, '')
    assert.match(
      originalStack(raw),
      new RegExp(`${pathRe(file)}:1:`),
      'a file edited since it loaded',
    )
    rmSync(file)
    assert.throws(() => originalStack(raw), /ENOENT/)
  })
})

describe('originalText', () => {
  test("a function's text is its file's, whatever the transform renamed", async () => {
    const body = `async (c: { send(s: string): void }) => {
    c.send(prompt)
  }`
    const root = tree({
      'evals/helpers.ts': "export const prompt = 'go'\n",
      'x/helpers.ts': "export const other = 'x'\nexport const pick = (n: number) => n * 2\n",
      'evals/main.ts': `import { other } from '../x/helpers'
import { prompt } from './helpers'
export const fns = {
  other: () => other,
  body: ${body},
  word: (n: number) => n,
  text: () => 'a string',
}
`,
    })
    const file = join(root, 'evals/main.ts')
    const { fns } = (await loadEvalFile(file, root)) as { fns: Record<string, () => void> }
    const { pick } = (await loadEvalFile(join(root, 'x/helpers.ts'), root)) as {
      pick: () => void
    }
    assert.match(String(fns.body), /_helpers2\.prompt/, 'the transform renamed the import')
    assert.equal(originalText(String(fns.body), file), body)
    assert.equal(originalText(String(fns.word), file), '(n: number) => n')
    assert.equal(originalText(String(fns.text)), "() => 'a string'")
    assert.equal(originalText(String(pick), file), '(n: number) => n * 2', 'found in another file')
    assert.equal(originalText('() => "nowhere"', file), undefined)
    assert.equal(originalText(String(pick), join(root, 'not-loaded.ts')), '(n: number) => n * 2')
  })
})
