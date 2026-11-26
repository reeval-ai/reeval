// The result layouts `reeval run`, summary.md and `reeval show` print, and `reeval compare`'s: each
// layout rendered from corpus runs and held to its golden, test/fixtures/output/<name>.txt
// (REEVAL_UPDATE_SNAPSHOTS=1 rewrites them; review the diff), and the rules every layout keeps.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  COMPARE_GOLDENS,
  type CompareGolden,
  GOLDENS,
  goldenCompare,
  goldenRender,
  goldenSuite,
  OUTPUT_DIR,
} from '../scripts/output/goldens.ts'
import { corpusEntries } from '../scripts/schema/corpus.ts'
import { renderSummary } from '../src/history/summary.ts'
import type { RunRecord } from '../src/history/types.ts'
import { fenced } from '../src/text.ts'
import { colors, stripAnsi } from '../src/ui/colors.ts'
import { type CompareInput, compareTally, renderCompare } from '../src/ui/compare-layout.ts'
import { layout, render, tallyLine } from '../src/ui/layout.ts'
import { readableRecord } from '../src/view/record.ts'
import type { SuiteTally } from '../src/view/suite.ts'

const UPDATE = !!process.env.REEVAL_UPDATE_SNAPSHOTS
const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url))

const rendered = (name: string) => {
  const g = GOLDENS.find((x) => x.name === name)
  assert.ok(g, name)
  return goldenRender(g)
}

const comparedText = (g: CompareGolden, input = goldenCompare(g)) =>
  renderCompare(input, { color: false, verbose: !!g.verbose })

const compareGolden = (name: string) => {
  const g = COMPARE_GOLDENS.find((x) => x.name === name)
  assert.ok(g, name)
  return g
}

describe('output goldens', () => {
  for (const g of [...GOLDENS, ...COMPARE_GOLDENS]) {
    test(g.name, () => {
      const lines = COMPARE_GOLDENS.includes(g as CompareGolden)
        ? comparedText(g as CompareGolden)
        : rendered(g.name)
      const text = `${lines.join('\n')}\n`
      const file = join(OUTPUT_DIR, `${g.name}.txt`)
      if (UPDATE) {
        mkdirSync(OUTPUT_DIR, { recursive: true })
        writeFileSync(file, text)
      }
      assert.ok(existsSync(file), `no golden ${file}; run with REEVAL_UPDATE_SNAPSHOTS=1`)
      assert.equal(text, readFileSync(file, 'utf8'))
    })
  }
})

describe('every layout', () => {
  test('layout() picks the shape from what the eval varies, and a family keeps it', () => {
    for (const [across, kind] of [
      ['none', 'results'],
      ['change', 'measure'],
      ['harness', 'agents'],
      ['both', 'both'],
    ] as const) {
      assert.deepEqual(layout(across, false, false), { kind, family: false })
      assert.deepEqual(layout(across, true, false), { kind, family: true })
    }
  })

  test('ends with the tally, and each eval heads its block with the number its target reads', () => {
    for (const g of GOLDENS) {
      const lines = rendered(g.name)
      assert.match(
        lines.at(-1) ?? '',
        /^(\d+ (run errors?|evals?|on target|below|report only|infra errors?|canceled|skipped)( · )?)+$/,
        g.name,
      )
      if (!g.verbose) assert.doesNotMatch(lines.join('\n'), /interval|difference/, g.name)
      const heads = lines.filter((l) => /^[✓✗·–○] /.test(l))
      assert.ok(heads.length, g.name)
      for (const head of heads) {
        assert.match(
          head,
          / {2}(\d+%|\d+\/\d+ (runs?|cases?)|every run|skipped|todo|not run|infra error|canceled)/,
          head,
        )
      }
    }
  })

  test('✓ and ✗ only for a blocking target; · for one that only reports', () => {
    const text = rendered('suite').join('\n')
    assert.match(text, /^✓ writes-greet-js +1\/1 run at 100% +regression\(1\)$/m)
    assert.match(text, /^✓ choose +83% ≥ 80% +metric\(0\.8\)$/m)
    assert.match(text, /^✗ explains-why-greet-js-fails +67% < 80% +metric\(0\.8\)$/m)
    assert.match(text, /^· greets-once +100% +metric\(\)$/m)
    assert.match(
      text,
      /^· adds-a-button-that-builds +2\/3 cases hit 100% \(pass@1\) +capability\(1\)$/m,
    )
    assert.doesNotMatch(text, /^[✓✗] .*(metric\(\)|capability\(1\))$/m, 'canary: never ✓ or ✗')
  })

  test('statistics only with -v', () => {
    for (const name of ['measure-a-change', 'family-with-change']) {
      assert.doesNotMatch(rendered(name).join('\n'), /interval|difference/, name)
      assert.match(rendered(`${name}-verbose`).join('\n'), /95% interval/, name)
    }
  })

  test("a check that didn't run reads not run, never 0 of N", () => {
    const text = rendered('measure-a-change').join('\n')
    assert.match(text, /^ {2}exclaims +not run {2}4 of 4 +not run$/m)
    assert.doesNotMatch(text, /^ {2}exclaims +0 of/m, 'canary: not 0 of N')
  })

  test('a pass is one line; a miss lists the cases that cost points and why', () => {
    const text = rendered('results').join('\n')
    assert.match(text, /^✓ writes-greet-js .*$(\n[✓✗·] |\n\n|$(?![\s\S]))/m)
    assert.match(
      text,
      /^✗ greets-in-french .*\n {4}#1 {2}0% {2}greet\.js has no French greeting\n {6}file: greet\.js\n {6}exitCode: 1\n {6}after turn 1$/m,
    )
    assert.match(
      text,
      /^ {4}#2 {2}50% {2}names-the-root-cause 0%, judge "How clearly does the answer name the root cause\?" 50%$/m,
    )
    assert.doesNotMatch(text, /^ {4}#1 {2}100%/m, 'canary: a case at 100% only with -v')
    assert.match(rendered('results-verbose').join('\n'), /^ {4}#1 {2}100%$/m)
  })

  test("an EvalError's frames print only with -v; a plain error's always", () => {
    const text = rendered('results').join('\n')
    assert.match(text, /^ {6}at task \(evals\/reads-the-fixture-repo\.eval\.ts:\d+:\d+\)$/m)
    assert.doesNotMatch(text, /^ {6}at task \(evals\/greets-in-french/m)
  })

  test('the upstream providers a gateway named print under the eval; none when it named none', () => {
    const g = GOLDENS.find((x) => x.name === 'results')
    assert.ok(g)
    const suite = goldenSuite(g)
    const bare = render(suite, null, { color: false, verbose: false }).join('\n')
    assert.doesNotMatch(bare, /served by/, 'canary: no upstream, no line')
    const e = suite.files[0]?.evals.find((x) => x.cells?.length)
    const cell = e?.cells?.[0]
    assert.ok(e && cell)
    cell.upstreams = [
      { provider: 'Anthropic', calls: 12 },
      { provider: 'Amazon Bedrock', calls: 3 },
    ]
    cell.judgeUpstreams = [{ provider: 'Typesafe', calls: 2 }]
    const text = render(suite, null, { color: false, verbose: false }).join('\n')
    assert.match(
      text,
      new RegExp(
        `${e.name} .*\\n(.*\\n)*? {2}served by Anthropic 12 · Amazon Bedrock 3; judge served by Typesafe 2$`,
        'm',
      ),
    )
  })

  test('a question whose every vote was a tie says so under its heading', () => {
    const g = GOLDENS.find((x) => x.name === 'measure-a-change')
    assert.ok(g)
    const suite = goldenSuite(g)
    const e = suite.files[0]?.evals[0]
    assert.ok(e)
    e.questions = [{ question: 'Which reads better?', votes: 4, rates: [], error: null }]
    const text = render(suite, null, { color: false, verbose: false }).join('\n')
    assert.match(text, /^ {2}question {2}Which reads better\?\n {4}4 votes, every one a tie$/m)
  })

  test("an attempt that didn't count reads its status in place of a score, never 0%", () => {
    const g = GOLDENS.find((x) => x.name === 'results')
    assert.ok(g)
    const suite = goldenSuite(g)
    const e = suite.files.flatMap((f) => f.evals).find((x) => x.name === 'writes-greet-js')
    const [a] = e?.scored ?? []
    assert.ok(e && a)
    e.outcome = 'canceled'
    e.scored = [
      {
        ...a,
        outcome: 'fail',
        score: null,
        error: { kind: 'aborted', message: 'The run was canceled' },
      },
    ]
    const text = render(suite, null, { color: false, verbose: false }).join('\n')
    assert.match(text, /^○ writes-greet-js +canceled$/m)
    e.outcome = 'fail'
    e.scored = [
      a,
      {
        ...a,
        n: 2,
        outcome: 'fail',
        score: null,
        error: { kind: 'aborted', message: 'The run was canceled' },
      },
    ]
    const missed = render(suite, null, { color: false, verbose: false }).join('\n')
    assert.match(missed, /^ {4}#2 {2}canceled {2}The run was canceled$/m)
    assert.doesNotMatch(missed, /^ {4}#2 {2}0%/m, 'canary: a cancel is not a 0')
  })

  test('the tally counts the evals, then on target, below and report only, leaving zeros out', () => {
    const c = colors(false)
    const tally = (t: Partial<SuiteTally>): SuiteTally => ({
      errors: 0,
      evals: 0,
      onTarget: 0,
      below: 0,
      reportOnly: 0,
      infraError: 0,
      canceled: 0,
      skipped: 0,
      ...t,
    })
    assert.equal(
      tallyLine(c, tally({ evals: 3, onTarget: 1, below: 1, reportOnly: 1 })),
      '3 evals · 1 on target · 1 below · 1 report only',
    )
    assert.equal(
      tallyLine(c, tally({ evals: 4, onTarget: 1, infraError: 2, skipped: 1 })),
      '4 evals · 1 on target · 2 infra errors · 1 skipped',
    )
    assert.equal(
      tallyLine(c, tally({ errors: 1, evals: 2, onTarget: 2 })),
      '1 run error · 2 evals · 2 on target',
    )
    assert.equal(tallyLine(c, tally({ evals: 1, canceled: 1 })), '1 eval · 1 canceled')
    assert.equal(tallyLine(c, tally({})), 'no evals ran')
  })

  test('render is pure, and color is the only difference color makes', () => {
    const g = GOLDENS.find((x) => x.name === 'suite')
    assert.ok(g)
    const plain = render(goldenSuite(g), null, { color: false, verbose: false })
    assert.deepEqual(render(goldenSuite(g), null, { color: false, verbose: false }), plain)
    const painted = render(goldenSuite(g), null, { color: true, verbose: false })
    assert.ok(painted.some((l) => l.includes('\x1b[')))
    assert.deepEqual(painted.map(stripAnsi), plain)
  })
})

describe('catch regressions (reeval compare)', () => {
  test('ends with the tally: regressed first, zeros left out, no statistics without -v', () => {
    const full = comparedText(compareGolden('compare'))
    assert.equal(
      full.at(-1),
      "1 regressed · 1 fixed · 1 can't compare · 1 new · 1 removed · 2 same",
    )
    for (const g of COMPARE_GOLDENS.filter((x) => !x.verbose)) {
      assert.doesNotMatch(comparedText(g).join('\n'), /lift|interval|noise|×/, g.name)
    }
    assert.match(
      comparedText(compareGolden('compare-verbose')).join('\n'),
      /tools 0 → 0 \(×–\) · agent <0\.1s → <0\.1s/,
    )
    const c = colors(false)
    const row = (status: CompareInput['rows'][number]['status']) => ({
      id: status,
      status,
      base: null,
      head: null,
    })
    assert.equal(compareTally(c, [row('same'), row('fixed'), row('same')]), '1 fixed · 2 same')
    assert.equal(compareTally(c, [row('infra')]), '1 infra error')
    assert.equal(compareTally(c, []), 'no evals to compare')
    const flipped = (status: 'regressed' | 'fixed') => ({
      ...row(status),
      verdict: 'family' as const,
    })
    const rated = {
      ...row('same'),
      cases: [flipped('regressed'), flipped('fixed'), flipped('fixed')],
    }
    assert.equal(
      compareTally(c, [row('regressed'), rated]),
      '1 regressed · 1 case now fails · 2 cases now pass · 1 same',
      'an eval with cases counts once, its flipped cases after the verdicts',
    )
  })

  test('a check not run on one side is not run, never a failure; a flip shows both sides', () => {
    const regressed = comparedText(compareGolden('compare-regressed')).join('\n')
    assert.match(regressed, /^ {2}house greeting {3}pass → fail\n {4}expected command to succeed/m)
    assert.match(regressed, /^ {2}sign-off {9}not run$/m)
    assert.doesNotMatch(regressed, /sign-off +(pass → )?fail/, 'canary: not printed as fail')
    const fixed = comparedText(compareGolden('compare-fixed')).join('\n')
    assert.match(fixed, /^ {2}fixed {12}double\n {4}build {12}fail → pass$/m)
    assert.match(fixed, /^ {4}types {12}not run → pass$/m)
    assert.doesNotMatch(fixed, /types +fail → pass/, 'canary: not run is not fail')
  })

  test('a check not run on both sides is no change: never a flip', () => {
    const g = compareGolden('compare-regressed')
    const input = goldenCompare(g)
    for (const side of [input.base, input.head]) {
      for (const e of side?.suite.files.flatMap((f) => f.evals) ?? []) {
        for (const cell of e.cells ?? []) {
          cell.checks.push({
            ...(cell.checks[0] as (typeof cell.checks)[number]),
            label: 'never reached',
            outcome: { status: 'not run' },
          })
        }
      }
    }
    const text = comparedText(g, input).join('\n')
    assert.match(text, /^ {2}never reached {4}not run$/m)
    assert.doesNotMatch(text, /never reached +\S+ → /, 'canary: not a flip')
    const fixed = compareGolden('compare-fixed')
    const fixedInput = goldenCompare(fixed)
    for (const side of [fixedInput.base, fixedInput.head]) {
      for (const k of side?.suite.files.flatMap((f) => f.evals).flatMap((e) => e.cases ?? []) ??
        []) {
        for (const cell of k.cells) {
          cell.checks.push({
            ...(cell.checks[0] as (typeof cell.checks)[number]),
            label: 'never reached',
            outcome: { status: 'not run' },
          })
        }
      }
    }
    assert.doesNotMatch(comparedText(fixed, fixedInput).join('\n'), /never reached/)
  })

  test('unchanged evals collapse to +N same in place, and the runs print once when no block names them', () => {
    const text = comparedText(compareGolden('compare-same-collapsed'))
    assert.deepEqual(text.slice(2), ['', '+2 same', '', '2 same'])
    assert.match(text[0] ?? '', /^base {13}\S+$/)
    const full = comparedText(compareGolden('compare')).join('\n')
    assert.doesNotMatch(full, /^base /m, 'a regressed block names them')
  })

  test('a removed eval sits where base had it, beside the one renamed from it', () => {
    const text = comparedText(compareGolden('compare'))
    const at = (re: RegExp) => text.findIndex((l) => re.test(l))
    const french = at(/^\+2 same$/)
    const german = at(/^removed {10}greets in German$/)
    const spanish = at(/^new {14}greets in Spanish$/)
    assert.ok(french < german && german < spanish, text.join('\n'))
  })

  test('a run that did not finish is noted above the tally', () => {
    const g = compareGolden('compare')
    for (const [status, note] of [
      [
        'interrupted',
        /^head \S+ didn’t finish, so some of its evals were canceled or haven’t run yet/m,
      ],
      ['budget', /^head \S+ stopped at its duration budget, so some of its evals never ran$/m],
    ] as const) {
      const input = goldenCompare(g)
      input.head.status = status
      assert.match(comparedText(g, input).join('\n'), note)
      assert.match(
        renderCompare({ ...input, base: null }, { color: false, verbose: false }).join('\n'),
        note,
        'with no baseline too',
      )
    }
    const complete = goldenCompare(g)
    complete.head.status = 'complete'
    assert.doesNotMatch(comparedText(g, complete).join('\n'), /interrupted|budget/, 'canary')
  })

  test('with no baseline, the count reads each new eval against its target, and names every outcome', () => {
    const g = compareGolden('compare-no-baseline')
    const input = goldenCompare(g)
    const [first, ...rest] = input.rows
    assert.ok(first)
    input.rows = [{ ...first, head: 'infra_error' }, ...rest]
    const last = comparedText(g, input).at(-1) ?? ''
    assert.match(last, /^6 new evals \(\d on target · \d below · 1 infra error\)$/)
    input.rows = [first, ...rest]
    for (const e of input.head.suite.files.flatMap((f) => f.evals)) e.blocking = false
    assert.equal(comparedText(g, input).at(-1), '6 new evals (6 report only)')
  })

  test('a side the interrupt canceled reads canceled, not fail', () => {
    const g = compareGolden('compare')
    const input = goldenCompare(g)
    const [first, ...rest] = input.rows
    assert.ok(first)
    const row = { ...first, status: 'drift' as const, base: 'pass' as const, head: 'fail' as const }
    input.rows = [{ ...row, canceled: ['head'] }, ...rest]
    const text = comparedText(g, input).join('\n')
    assert.match(
      text,
      /^can't compare {4}.+\n( {2}changed .+\n)? {2}base {13}\S+ {2}pass\n {2}head {13}\S+ {2}canceled$/m,
    )
    input.rows = [row, ...rest]
    assert.match(
      comparedText(g, input).join('\n'),
      /^ {2}head {13}\S+ {2}fail$/m,
      'canary: a real fail still reads fail',
    )

    const none = goldenCompare(compareGolden('compare-no-baseline'))
    const [added, ...others] = none.rows
    assert.ok(added)
    none.rows = [{ ...added, head: 'fail', canceled: ['head'] }, ...others]
    const last = renderCompare(none, { color: false, verbose: false }).at(-1) ?? ''
    assert.match(last, /^6 new evals \(\d on target · (\d below · )?1 canceled\)$/)
  })

  test('color is the only difference color makes', () => {
    const input = goldenCompare(compareGolden('compare'))
    const plain = renderCompare(input, { color: false, verbose: false })
    const painted = renderCompare(input, { color: true, verbose: false })
    assert.ok(painted.some((l) => l.includes('\x1b[')))
    assert.deepEqual(painted.map(stripAnsi), plain)
  })
})

describe('summary.md from RunReport', () => {
  const run = () => {
    const file = corpusEntries()
      .find((e) => e.name === 'with-layouts')
      ?.runs.at(-1)?.file
    assert.ok(file, 'with-layouts has a run')
    return readableRecord(JSON.parse(readFileSync(file, 'utf8')) as RunRecord)
  }

  test('renderSummary emits a GFM report with one H1 and no text dump fence', () => {
    const md = renderSummary(run())
    assert.match(md, /^# /m)
    assert.equal([...md.matchAll(/^# /gm)].length, 1)
    assert.doesNotMatch(md, /^```text$/m)
    assert.match(md, /^## Attempt index/m)
    assert.match(md, /^## State/m)
  })

  test('fenced is three backticks, or one more than the longest run inside', () => {
    assert.deepEqual(fenced(['plain'], 'text'), ['```text', 'plain', '```'])
    assert.deepEqual(fenced(['a `b` ``c``']), ['```', 'a `b` ``c``', '```'])
    assert.deepEqual(fenced(['````x'], 'json'), ['`````json', '````x', '`````'])
  })
})

test('output:preview renders every corpus run and golden from src/', () => {
  const r = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', 'scripts/output/preview.ts', 'all'],
    { cwd: PACKAGE_DIR, encoding: 'utf8' },
  )
  assert.equal(r.status, 0, r.stderr)
  assert.doesNotMatch(r.stdout, /\bundefined\b|\bNaN\b|\[object Object\]/)
  for (const g of [...GOLDENS, ...COMPARE_GOLDENS]) {
    assert.match(r.stdout, new RegExp(`^── golden ${g.name}$`, 'm'))
  }
  const [base, head] = (corpusEntries().find((e) => e.name === 'with-compare')?.runs ?? []).map(
    (run) => run.file,
  )
  const two = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--no-warnings',
      'scripts/output/preview.ts',
      `${base}`,
      `${head}`,
    ],
    { cwd: PACKAGE_DIR, encoding: 'utf8' },
  )
  assert.equal(two.status, 0, two.stderr)
  assert.match(two.stdout, /^── compare .*\n\ncan't compare {4}bills in minor units/m)
  const bad = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', 'scripts/output/preview.ts', 'no-such-entry'],
    { cwd: PACKAGE_DIR, encoding: 'utf8' },
  )
  assert.equal(bad.status, 2)
  assert.match(bad.stderr, /^No corpus entry or golden no-such-entry\. Entries: /)
})
