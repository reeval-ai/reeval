import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { corpusEntries } from '../scripts/schema/corpus.ts'
import { resolveConfig } from '../src/config.ts'
import type { AttemptRecord, EvalEntry, RunRecord } from '../src/history/types.ts'
import { cascade } from '../src/options.ts'
import { FORBIDDEN_OUTPUT, runReportMarkdown } from '../src/renderer/markdown.ts'
import { unbiasedPassAtK, unbiasedPassHatK } from '../src/stats.ts'
import type { CompareRow } from '../src/view/compare.ts'
import { costPerSuccess } from '../src/view/effort.ts'
import { NewerSchemaError, readableRecord } from '../src/view/record.ts'
import type { RunRemarks } from '../src/view/remarks.ts'
import {
  attemptAnchor,
  attemptAnchorId,
  buildRunReport,
  headlineResultText,
  REPORT_VERSION,
  readableRunReport,
  runReportSchema,
} from '../src/view/report/index.ts'

function loadCorpusRun(name: string): RunRecord {
  const file = corpusEntries()
    .find((e) => e.name === name)
    ?.runs.at(-1)?.file
  assert.ok(file, `${name} has a run`)
  return readableRecord(JSON.parse(readFileSync(file, 'utf8')) as RunRecord)
}

function cloneRecord(name: string): RunRecord {
  return structuredClone(loadCorpusRun(name))
}

describe('buildRunReport', () => {
  test('parses with runReportSchema and emits clean GFM for every corpus entry', () => {
    for (const entry of corpusEntries()) {
      const file = entry.runs.at(-1)?.file
      if (!file) continue
      const record = readableRecord(JSON.parse(readFileSync(file, 'utf8')) as RunRecord)
      const report = buildRunReport(record, { links: { base: './' } })
      assert.doesNotThrow(() => runReportSchema.parse(report), entry.name)
      const md = runReportMarkdown(report)
      for (const forbidden of FORBIDDEN_OUTPUT) {
        assert.doesNotMatch(md, forbidden.pattern, `${entry.name}: ${forbidden.name}`)
      }
      assert.equal([...md.matchAll(/^# /gm)].length, 1, `${entry.name}: one H1`)
      assert.doesNotMatch(md, /\blinesAdded\b/, `${entry.name}: no measure enum keys`)
      assert.doesNotMatch(md, /\b(private|product)[ -]?study\b/i)
    }
  })

  test('single-eval filter promotes the eval name to H1 and omits the roster', () => {
    const record = loadCorpusRun('with-layouts')
    const key = record.evals[0]?.key
    assert.ok(key)
    const report = buildRunReport(record, { evals: [key], links: { base: './' } })
    assert.equal(report.single, true)
    assert.equal(report.evals.length, 1)
    assert.equal(report.roster.length, 0)
    const md = runReportMarkdown(report)
    assert.match(
      md,
      new RegExp(`^# ${report.header.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'),
    )
    assert.doesNotMatch(md, /^## .+\n\n`[^`]+`\. /m)
    assert.doesNotMatch(md, /^## Coding harness roster/m)
  })

  test('regression headline leads with worse/fixed and prior-run context', () => {
    const head = cloneRecord('with-layouts')
    const prior = cloneRecord('with-layouts')
    prior.runId = 'prior-run-id'
    prior.startedAt = '2026-01-02T12:00:00.000Z'
    prior.git = {
      sha: 'abcdef1234567890',
      branch: 'main',
      dirty: false,
      diffHash: null,
      remote: 'https://example.com/demo.git',
      worktreePatch: null,
    }
    prior.author = 'fixture-author'
    const evalKey = head.evals[0]!.key
    const rows: CompareRow[] = [
      {
        id: evalKey,
        status: 'regressed',
        base: 'pass',
        head: 'fail',
        gate: { base: 'all', head: 'all', rescored: 'pass' },
        perCell: [
          {
            key: 'cell',
            base: { pass: 2, fail: 0, lift: null, effort: null },
            head: { pass: 0, fail: 2, lift: null, effort: null },
          },
        ],
      },
    ]
    const report = buildRunReport(head, {
      evals: [evalKey],
      links: { base: './' },
      prior: {
        record: prior,
        rows,
        changes: [
          {
            field: 'judgeModel',
            label: 'judge model',
            base: 'a',
            head: 'b',
            outsideFingerprint: false,
          },
        ],
      },
    })
    assert.doesNotThrow(() => runReportSchema.parse(report))
    const primary = report.evals[0]!.headline.primary
    assert.equal(primary.kind, 'regression')
    if (primary.kind !== 'regression') return
    assert.equal(primary.worse, 1)
    assert.equal(primary.fixed, 0)
    assert.ok(primary.lead)
    assert.equal(primary.lead?.prior, '2 of 2')
    assert.equal(primary.lead?.current, '0 of 2')
    assert.equal(report.evals[0]!.headline.fairness, 'too-few-runs')
    assert.ok(report.integrity.some((i) => i.kind === 'fairness-floor'))
    const block = report.evals[0]!.primary
    assert.equal(block?.kind, 'regression')
    if (block?.kind === 'regression') {
      assert.equal(block.prior.runId, 'prior-run-id')
      assert.equal(block.prior.gitSha, 'abcdef1234567890')
      assert.ok(block.whatChanged.some((line) => /judge model/.test(line)))
    }
    const md = runReportMarkdown(report)
    assert.match(md, /\*\*1 worse: .+2 of 2 to 0 of 2\*\*/)
    assert.match(md, /Changes since 2026-01-02, abcdef1(?:, main)?, prior-run-id/)
    assert.match(md, /Prior run by fixture-author/)
    assert.match(md, /What changed/)
  })

  test('pass-rate headlines name found/used outcomes from discovery matchers', () => {
    const record = cloneRecord('with-layouts')
    const e = record.evals.find((ev) => !ev.compare) ?? record.evals[0]!
    for (const a of e.attempts) {
      a.assertions = [
        {
          label: 'used skill',
          matcher: 'toHaveCalledSkill',
          status: 'pass',
          soft: false,
        },
      ]
    }
    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    const primary = report.evals[0]!.headline.primary
    assert.equal(primary.kind, 'pass-rate')
    if (primary.kind === 'pass-rate') assert.equal(primary.outcome, 'used')
    assert.match(runReportMarkdown(report), /\*\*\d+% used\*\*/)
  })

  test('pre-satisfied checks emit integrity and keep full wording', () => {
    const record = cloneRecord('with-layouts')
    const e = record.evals.find((ev) => !ev.compare) ?? record.evals[0]!
    const attempt = e.attempts.find((a) => a.outcome === 'pass' || a.outcome === 'fail')
    assert.ok(attempt)
    attempt.assertions = [
      {
        label: 'has index',
        matcher: 'toHaveFile',
        status: 'pass',
        soft: false,
        preSatisfied: true,
      },
      {
        label: 'skipped on baseline',
        matcher: 'toHaveCalledSkill',
        status: 'not_applicable',
        soft: true,
        reason: 'baseline has no skill',
      },
    ]
    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    assert.ok(report.integrity.some((i) => i.kind === 'pre-satisfied'))
    const task = report.evals[0]!.primary
    assert.equal(task?.kind, 'task')
    if (task?.kind !== 'task') return
    const pre = task.assertions.find((row) => row.label === 'has index')
    assert.ok(pre)
    assert.match(pre!.total.text, /pre-satisfied/)
    const na = task.assertions.find((row) => row.label === 'skipped on baseline')
    assert.ok(na)
    assert.equal(na!.total.reason, 'baseline has no skill')
    assert.match(na!.total.text, /baseline has no skill/)
  })

  test('diagnostic judges omit at-or-above tallies', () => {
    const record = cloneRecord('with-layouts')
    const e = record.evals.find((ev) => !ev.compare) ?? record.evals[0]!
    for (const a of e.attempts.slice(0, 2)) {
      a.judgements = [
        {
          key: '0:diag',
          label: 'clarity',
          question: 'Is the change clear?',
          verdict: 'pass',
          score: 0.8,
          threshold: 0.5,
          model: 'fake',
        },
      ]
      // No toPass assertion → diagnostic; scored threshold must not invent an at-or-above tally.
      a.assertions = []
    }
    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    const judgments = report.evals[0]!.judgments
    assert.ok(judgments)
    assert.equal(judgments!.scores[0]!.threshold, null)
    assert.equal(judgments!.scores[0]!.atOrAbove, null)
    const md = runReportMarkdown(report)
    assert.match(md, /diagnostic/)
    assert.doesNotMatch(md, /At or above/)
  })

  test('A/B tables name pass-rate verdicts with product labels', () => {
    const record = loadCorpusRun('with-layouts')
    const e = record.evals.find((ev) => ev.compare)
    assert.ok(e)
    const report = buildRunReport(record, { evals: [e!.key], links: { base: './' } })
    const comparison = report.evals[0]!.primary
    assert.equal(comparison?.kind, 'comparison')
    if (comparison?.kind === 'comparison') {
      assert.ok(comparison.summary.every((row) => row.verdictScope === 'pass-rate'))
    }
    const md = runReportMarkdown(report)
    assert.match(md, /Pass-rate verdict/)
    assert.doesNotMatch(md, /\| made-worse \|/)
    assert.doesNotMatch(md, /\| pass-rate \|/)
  })

  test('cost header labels agent, judge, and basis', () => {
    const record = cloneRecord('with-layouts')
    record.cost = {
      agentUsd: { usd: 1.25, basis: 'reported', source: 'fixture' },
      judgeUsd: { usd: 0.25, basis: 'estimated', source: 'fixture' },
    }
    const report = buildRunReport(record, { links: { base: './' } })
    assert.ok(report.header.cost)
    assert.equal(report.header.cost!.basis, 'mixed')
    assert.ok(report.header.cost!.agent)
    assert.ok(report.header.cost!.judge)
    assert.ok(report.header.cost!.total)
    assert.match(runReportMarkdown(report), /agent \$.+, judge \$.+ \(mixed\)/)
  })

  test('colliding transcript paths get distinct attempt hrefs', () => {
    const record = cloneRecord('with-layouts')
    const e = record.evals.find((ev) => ev.compare && ev.attempts.length >= 2)
    assert.ok(e)
    const [a, b] = e!.attempts
    assert.ok(a && b)
    const shared = {
      path: 'shared/transcript.jsonl',
      sha256: '0'.repeat(64),
      bytes: 1,
    }
    a.files.transcript = shared
    b.files.transcript = { ...shared }
    const report = buildRunReport(record, { evals: [e!.key], links: { base: './' } })
    const hrefs = report.attempts.map((row) => row.href)
    assert.equal(new Set(hrefs).size, hrefs.length)
    assert.ok(hrefs.some((h) => h.includes('shared/transcript.jsonl')))
    assert.ok(hrefs.includes(attemptAnchor(b.key)), 'the second falls back to its anchor')
    assert.match(attemptAnchor(b.key), /^#attempt-[a-z0-9-]+$/)
  })

  test('attempt anchors come from the stable key, the same in any report of the run, and each resolves', () => {
    const record = loadCorpusRun('with-layouts')
    const whole = buildRunReport(record)
    const lastSeq = (e: (typeof record.evals)[number]) =>
      Math.max(-1, ...e.attempts.map((a) => a.seq ?? -1))
    const last = [...record.evals].sort((a, b) => lastSeq(b) - lastSeq(a))[0]
    assert.ok(last)
    const one = buildRunReport(record, { evals: [last.key] })
    const keyOf = (r: typeof whole) => new Map(r.attempts.map((a) => [a.key, a]))
    const all = keyOf(whole)
    let renumbered = 0
    for (const row of one.attempts) {
      const same = all.get(row.key)
      assert.ok(same, row.key)
      if (same.id !== row.id) renumbered++
      if (row.href.startsWith('#')) assert.equal(row.href, same.href, 'the anchor is the same')
    }
    assert.ok(renumbered > 0, 'the one-eval report numbers its attempts from A1')
    const md = runReportMarkdown(whole)
    const targets = new Set([...md.matchAll(/<a id="([^"]+)"><\/a>/g)].map((m) => m[1]))
    assert.equal(targets.size, whole.attempts.length, 'one anchor per attempt, all distinct')
    for (const a of whole.attempts) assert.ok(targets.has(attemptAnchorId(a.key)), a.key)
    const links = [...md.matchAll(/\]\(#(attempt-[^)]+)\)/g)].map((m) => m[1] as string)
    for (const link of links) assert.ok(targets.has(link), `#${link} has a target`)
    const cites = JSON.stringify(whole).match(/"id":"A\d+","key":"[^"]+"/g) ?? []
    assert.ok(cites.length > 0, 'every AttemptRef carries its key')
  })

  test('text headlines disclose representative multi-answer collapse', () => {
    const record = cloneRecord('with-layouts')
    const e = record.evals.find((ev) => !ev.compare) ?? record.evals[0]!
    e.attempts = e.attempts.slice(0, 2).map((a, i) => ({
      ...a,
      assertions: [],
      answers: [
        {
          question: 'What stood out?',
          text: `Answer ${i + 1}`,
          choice: null,
          input: null,
        },
      ],
    }))
    // Clear choices/judgments so text path wins.
    for (const a of e.attempts) {
      a.judgments = []
      a.observations = []
    }
    e.answers = undefined
    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    const primary = report.evals[0]!.headline.primary
    assert.equal(primary.kind, 'text')
    if (primary.kind === 'text') {
      assert.equal(primary.leadRole, 'representative')
      assert.ok(primary.answered.k >= 2)
    }
    assert.match(runReportMarkdown(report), /Showing 1 of \d+ answers as representative/)
  })

  test("a text headline's quote cites a real attempt, or is left out when it has none", () => {
    const textReport = (unnumbered: boolean) => {
      const record = cloneRecord('with-layouts')
      const e = record.evals.find((ev) => !ev.compare) ?? record.evals[0]!
      e.attempts = e.attempts.slice(0, 1).map((a) => ({
        ...a,
        seq: unnumbered ? null : a.seq,
        assertions: [],
        judgments: [],
        observations: [],
        answers: [{ question: 'What stood out?', text: 'The tests', choice: null, input: null }],
      }))
      e.answers = undefined
      return buildRunReport(record, { evals: [e.key], links: { base: './' } })
    }
    const cited = textReport(false).evals[0]!.headline.primary
    assert.equal(cited.kind, 'text')
    if (cited.kind === 'text') {
      assert.match(cited.lead?.attempt.id ?? '', /^A\d+$/)
      assert.notEqual(cited.lead?.attempt.href, '#')
    }
    const report = textReport(true)
    const uncited = report.evals[0]!.headline.primary
    assert.equal(uncited.kind, 'text')
    if (uncited.kind === 'text') {
      assert.equal(uncited.lead, null)
      assert.equal(uncited.leadRole, null)
    }
    assert.doesNotMatch(JSON.stringify(report), /"A\?"/)
    assert.doesNotMatch(runReportMarkdown(report), /\]\(#\)/)
  })
})

describe('readableRunReport', () => {
  const golden = () =>
    JSON.parse(
      readFileSync(new URL('./fixtures/summary/with-layouts/report.json', import.meta.url), 'utf8'),
    ) as Record<string, unknown>

  /** The report's `z.record` fields, whose own keys are data, not fields. */
  const RECORDS = new Set(['cells', 'counts'])

  /** Adds `newerField` to every object in `value`, at every depth; returns how many it marked. */
  function markEveryObject(value: unknown, record = false): number {
    if (Array.isArray(value)) return value.reduce((n, v) => n + markEveryObject(v), 0)
    if (typeof value !== 'object' || value === null) return 0
    let n = record ? 0 : 1
    for (const [k, v] of Object.entries(value)) n += markEveryObject(v, RECORDS.has(k))
    if (!record) (value as Record<string, unknown>).newerField = { from: 'a newer reeval' }
    return n
  }

  test('passes unknown fields at every level, which the strict schema refuses', () => {
    const report = golden()
    const marked = markEveryObject(report)
    assert.ok(marked > 100, `marked ${marked} objects`)
    assert.throws(() => runReportSchema.parse(report))
    const read = readableRunReport(structuredClone(report))
    assert.deepEqual(read, report, 'every unknown field is kept')
  })

  test('still refuses a missing or mistyped field', () => {
    const missing = golden()
    delete (missing.header as Record<string, unknown>).title
    assert.throws(() => readableRunReport(missing), {
      message: "This report's header.title is missing: it must be a string",
    })
    const mistyped = golden()
    ;(mistyped.attempts as Array<Record<string, unknown>>)[0]!.id = 7
    assert.throws(() => readableRunReport(mistyped, 'report.json'), {
      message: "report.json's attempts[0].id must be a string (got 7)",
    })
    const empty = golden()
    empty.evals = []
    assert.throws(() => readableRunReport(empty), {
      message: "This report's evals must hold at least one eval (got [])",
    })
    for (const root of [42, null, []]) {
      assert.throws(() => readableRunReport(root), {
        message: `This report must be an object (got ${JSON.stringify(root)})`,
      })
    }
    const variant = golden()
    const section = (variant.evals as Array<Record<string, unknown>>)[0]!
    section.primary = { kind: 'future-kind' }
    assert.throws(
      () => readableRunReport(variant),
      /^Error: This report's evals\[0\]\.primary[^\n]+$/,
    )
  })

  test('refuses a report from a newer reeval', () => {
    const newer = { ...golden(), reportVersion: REPORT_VERSION + 1 }
    assert.throws(() => readableRunReport(newer), NewerSchemaError)
    assert.throws(
      () => readableRunReport(newer),
      new RegExp(
        `This report was written by a newer reeval \\(reportVersion ${REPORT_VERSION + 1}; `,
      ),
    )
  })
})

describe('RunReport links', () => {
  test('links.base prefixes artifact links and links.record replaces the record href', () => {
    const record = loadCorpusRun('with-layouts')
    const plain = buildRunReport(record)
    assert.equal(plain.provenance.record, `../${record.runId}.json`, 'the record beside the folder')
    const base = `/runs/${record.runId}/files/`
    const hosted = buildRunReport(record, {
      links: { base, record: `/runs/${record.runId}/record` },
    })
    assert.equal(hosted.provenance.record, `/runs/${record.runId}/record`)
    const transcripts = hosted.attempts.flatMap((a) => a.links.transcript ?? [])
    assert.ok(transcripts.length > 0)
    for (const t of transcripts) assert.ok(t.startsWith(base), t)
    assert.doesNotMatch(JSON.stringify(hosted), /"\.\/[^"]+"/, 'no link is left relative to ./')
  })

  test('links.base is a folder with or without its trailing /', () => {
    const record = loadCorpusRun('with-layouts')
    const slashed = JSON.stringify(buildRunReport(record, { links: { base: 'https://h/x/' } }))
    const bare = JSON.stringify(buildRunReport(record, { links: { base: 'https://h/x' } }))
    assert.equal(bare, slashed)
    assert.match(bare, /"https:\/\/h\/x\/evals-/)
    assert.doesNotMatch(bare, /https:\/\/h\/x[^/]/)
    assert.equal(
      JSON.stringify(buildRunReport(record, { links: { base: './' } })),
      JSON.stringify(buildRunReport(record)),
      './ is the default',
    )
  })
})

/** `with-layouts`' A/B eval with two variants on one coding harness. */
function twoVariants(record: RunRecord): EvalEntry {
  const e = record.evals.find(
    (ev) =>
      ev.compare &&
      new Set(ev.cells.map((c) => c.harness)).size === 1 &&
      ev.cells.filter((c) => c.role === 'variant').length >= 2,
  )
  assert.ok(e, 'with-layouts has an A/B eval with two variants')
  return e
}

/** That eval run again on a second coding harness, `other`. */
function onTwoHarnesses(): { record: RunRecord; e: EvalEntry } {
  const record = cloneRecord('with-layouts')
  const e = twoVariants(record)
  const harness = e.cells[0]!.harness
  const rename = (key: string) => key.replace(`${harness}/`, 'other/')
  const lastSeq = Math.max(...record.evals.flatMap((ev) => ev.attempts.map((a) => a.seq ?? 0)))
  e.cells.push(
    ...e.cells.map((c) => ({ ...structuredClone(c), key: rename(c.key), harness: 'other' })),
  )
  e.attempts.push(
    ...e.attempts.map((a, i) => ({
      ...structuredClone(a),
      key: `${a.key}~other`,
      id: rename(a.id),
      cell: rename(a.cell),
      seq: a.seq === null ? null : lastSeq + 1 + i,
    })),
  )
  return { record, e }
}

describe('RunReport chart data', () => {
  test('each contrast row names its coding harness and counts, so no two rows repeat', () => {
    const { record, e } = onTwoHarnesses()
    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    const comparison = report.evals[0]!.primary
    assert.equal(comparison?.kind, 'comparison')
    if (comparison?.kind !== 'comparison') return
    assert.equal(comparison.contrasts.length, 6, '3 pairs on each of 2 harnesses')
    const ids = comparison.contrasts.map((c) => `${c.from}|${c.to}|${c.harness}|${c.sandbox}`)
    assert.equal(new Set(ids).size, ids.length)
    assert.deepEqual(
      new Set(comparison.contrasts.map((c) => c.harness)),
      new Set(['fake', 'other']),
    )
    for (const c of comparison.contrasts) {
      assert.ok(c.fromPassed && c.toPassed)
      assert.ok(c.fromPassed.n > 0 && c.toPassed.n > 0)
    }
    const md = runReportMarkdown(report)
    assert.match(md, /\| From \| To \| Coding harness \| Measure \|/)
    assert.match(md, /\| with-skill \| plain \| other \| Pass rate \|/)
  })

  test('a baseline-never-passes check is one integrity line naming its harnesses', () => {
    const { record, e } = onTwoHarnesses()
    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    const never = report.integrity.filter((i) => i.kind === 'baseline-never-passes')
    assert.ok(never.length > 0)
    const texts = never.map((i) => i.text)
    assert.equal(new Set(texts).size, texts.length, 'no message repeats')
    for (const t of texts) assert.match(t, / on every coding harness;/)
    const ids = report.integrity.map((i) => `${i.kind}|${i.evalId}|${i.text}`)
    assert.equal(new Set(ids).size, ids.length, 'no issue repeats')
  })

  test('the kicker names the variant the headline picked, not the first one declared', () => {
    const record = cloneRecord('with-layouts')
    const e = twoVariants(record)
    const variants = e.cells.filter((c) => c.role === 'variant')
    const [first, second] = variants
    assert.ok(first && second)
    for (const a of e.attempts) {
      if (a.cell === first.key && a.outcome === 'pass') a.outcome = 'fail'
      if (a.cell === second.key && a.outcome === 'fail') a.outcome = 'pass'
    }
    const control = e.cells.find((c) => c.role === 'control')!
    for (const a of e.attempts) if (a.cell === control.key) a.outcome = 'fail'
    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    const headline = report.evals[0]!.headline
    assert.equal(headline.primary.kind, 'lift')
    if (headline.primary.kind !== 'lift') return
    assert.equal(headline.primary.variant.label, second.variant)
    assert.equal(headline.kicker, `${second.variant} against the ${control.environment} baseline`)
  })

  test("a remark's edit is a next step, and its line is the finding alone", () => {
    const record = cloneRecord('with-layouts')
    const e = record.evals[0]!
    const remarks: RunRemarks = {
      kind: 'reeval-remarks',
      schemaVersion: 1,
      runId: record.runId,
      createdAt: record.startedAt,
      remarks: [
        {
          id: 'r1',
          evalId: e.id,
          evalKey: e.key,
          kind: 'too-few-tries',
          severity: 'concern',
          text: '1 run per side.',
          evidence: [],
          fix: { at: 'source:evals/a.eval.ts#L12', edit: 'set runs: 4' },
          firstSeenRun: record.runId,
        },
      ],
    }
    const report = buildRunReport(record, { evals: [e.key], remarks, links: { base: './' } })
    const section = report.evals[0]!
    assert.equal(section.failures?.remarks[0]?.line, '1 run per side.')
    assert.deepEqual(section.next, [
      { kind: 'too-few-tries', text: 'set runs: 4', at: 'evals/a.eval.ts:12' },
    ])
    const md = runReportMarkdown(report)
    assert.match(md, /^- \(concern\) 1 run per side\.$/m)
    assert.match(md, /^#{2,3} Next\n\n- At evals\/a\.eval\.ts:12: set runs: 4\.$/m)
    assert.doesNotMatch(JSON.stringify(report), /\[object Object\]/)
  })

  test('the rollup carries its result as numbers, and prints the text they format to', () => {
    for (const entry of corpusEntries()) {
      const file = entry.runs.at(-1)?.file
      if (!file) continue
      const record = readableRecord(JSON.parse(readFileSync(file, 'utf8')) as RunRecord)
      const report = buildRunReport(record, { links: { base: './' } })
      for (const row of report.rollup?.rows ?? []) {
        assert.ok(row.result, `${entry.name}: ${row.name} has a result`)
        assert.equal(headlineResultText(row.result), row.primary, `${entry.name}: ${row.name}`)
        assert.ok(runReportMarkdown(report).includes(`| ${row.primary.replace(/\|/g, '\\|')} |`))
      }
    }
  })

  test('an A/B eval in the rollup has a median tokens figure per arm', () => {
    const { record } = onTwoHarnesses()
    let tokens = 1000
    for (const e of record.evals) {
      for (const a of e.attempts) {
        a.usage = { input: tokens, output: 10, cacheRead: 0, cacheWrite: 0, reasoning: null }
        tokens += 1000
      }
    }
    const report = buildRunReport(record, { links: { base: './' } })
    const ab = report.rollup?.rows.find((r) => r.shapes.includes('ab'))
    assert.ok(ab)
    assert.equal(ab.result?.kind === 'lift' || ab.result?.kind === 'tied-ceiling', true)
    assert.equal(ab.medianTokens.value, null)
    const section = report.evals.find((s) => s.id === ab.evalId)
    assert.ok(section?.primary?.kind === 'comparison')
    assert.deepEqual(
      ab.medianTokensByArm?.map((a) => a.arm),
      section.primary.summary.map((r) => r.arm),
    )
    assert.deepEqual(
      ab.medianTokensByArm?.map((a) => a.tokens.value),
      section.primary.summary.map((r) => r.measures.tokens?.value?.median.value ?? null),
    )
    assert.ok(ab.medianTokensByArm?.some((a) => typeof a.tokens.value === 'number'))
  })

  test('each attempt carries its token and time split and its judge calls', () => {
    const record = cloneRecord('with-layouts')
    const e = record.evals.find((ev) => !ev.compare) ?? record.evals[0]!
    const a = e.attempts.find((x) => x.seq !== null)!
    a.usage = { input: 100, output: 40, cacheRead: 800, cacheWrite: 60, reasoning: 12 }
    a.timeSplit = { modelMs: 3000, toolMs: 1500, waitingMs: 0, otherMs: 500 }
    a.judgements = [
      {
        key: '0:q',
        label: 'clear',
        question: 'Is it clear?',
        verdict: 'fail',
        score: 0.3,
        threshold: 0.7,
        model: 'fake',
      },
    ]
    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    const row = report.attempts.find((r) => r.key === a.key)!
    assert.deepEqual(row.usage, a.usage)
    assert.equal(row.tokens.value, 1000)
    assert.deepEqual(row.time, { ...a.timings, agent: a.timeSplit })
    assert.equal(row.time?.agentMs, row.agentMs.value)
    assert.deepEqual(row.judgments, [
      { label: 'clear', score: 0.3, threshold: 0.7, verdict: 'fail', gated: false },
    ])
    const judge = report.evals[0]!.judgments?.scores.find((s) => s.label === 'clear')
    assert.deepEqual(judge?.scores, [
      {
        attempt: row.id,
        key: a.key,
        keys: judge?.scores?.[0]?.keys,
        score: 0.3,
        verdict: 'fail',
        outcome: row.outcome,
      },
    ])
    assert.doesNotThrow(() => runReportSchema.parse(report))
  })

  test("every judge row's scores are the values behind its spread", () => {
    for (const entry of corpusEntries()) {
      const file = entry.runs.at(-1)?.file
      if (!file) continue
      const record = readableRecord(JSON.parse(readFileSync(file, 'utf8')) as RunRecord)
      for (const section of buildRunReport(record).evals) {
        for (const row of section.judgments?.scores ?? []) {
          assert.equal(row.scores?.length, row.spread.n, `${entry.name}: ${row.label}`)
        }
      }
    }
  })

  test('choice rows and regression rows carry k and n', () => {
    for (const entry of corpusEntries()) {
      const file = entry.runs.at(-1)?.file
      if (!file) continue
      const record = readableRecord(JSON.parse(readFileSync(file, 'utf8')) as RunRecord)
      for (const section of buildRunReport(record).evals) {
        for (const choice of section.choices) {
          for (const row of choice.rows) {
            assert.deepEqual(
              row.picks,
              choice.options.map((o) => ({
                option: o.label,
                k: row.counts[o.label] ?? 0,
                n: row.attempts,
              })),
            )
          }
        }
      }
    }
  })
})

function assertCleanMarkdown(md: string): void {
  for (const forbidden of FORBIDDEN_OUTPUT) {
    assert.doesNotMatch(md, forbidden.pattern, forbidden.name)
  }
}

describe('RunReport metric best practices', () => {
  test('multi-task evals keep pooled pass rate as default and expose per-task rows and equal-weight taskRate', () => {
    const record = cloneRecord('with-layouts')
    const e = record.evals.find((ev) => !ev.compare && (ev.cases?.length ?? 0) >= 2)!
    assert.ok(e)
    // Build unequal trial counts: task "easy" gets 10/10 passes; task "hard" gets 0/1 passes.
    e.cases = [
      { ...e.cases![0]!, key: 'easy', name: undefined, label: 'easy' },
      { ...e.cases![1]!, key: 'hard', name: undefined, label: 'hard' },
    ]
    const template = structuredClone(e.attempts[0]!)
    const makeAttempt = (
      caseKey: string,
      n: number,
      pass: boolean,
      seq: number,
    ): AttemptRecord => ({
      ...structuredClone(template),
      key: `${e.key} [${caseKey}] # ${template.cell}#${n}`,
      id: `${template.cell}#${caseKey}#${n}`,
      case: caseKey,
      n,
      seq,
      outcome: pass ? 'pass' : 'fail',
      assertions: [
        {
          label: 'builds',
          matcher: 'toSucceed',
          status: pass ? 'pass' : 'fail',
          soft: false,
        },
      ],
    })
    e.attempts = [
      ...Array.from({ length: 10 }, (_, i) => makeAttempt('easy', i + 1, true, 100 + i)),
      makeAttempt('hard', 1, false, 110),
    ]

    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    assert.doesNotThrow(() => runReportSchema.parse(report))
    const section = report.evals[0]!
    assert.equal(section.headline.primary.kind, 'pass-rate')
    if (section.headline.primary.kind !== 'pass-rate') return

    // Default headline stays pooled (10 of 11 = 91%), while taskRate exposes equal-weight 50%.
    assert.equal(section.headline.primary.rate.k, 10)
    assert.equal(section.headline.primary.rate.n, 11)
    assert.equal(section.headline.primary.rate.text, '91%')
    assert.equal(section.headline.primary.tasks, 2)
    assert.equal(section.headline.primary.taskRate?.value, 0.5)
    assert.equal(section.headline.primary.taskRate?.text, '50%')
    assert.equal(section.headline.primary.passAtK, undefined, 'no silent k default')
    assert.equal(section.headline.primary.passHatK, undefined, 'no silent k default')

    const taskBlock = section.primary
    assert.equal(taskBlock?.kind, 'task')
    if (taskBlock?.kind !== 'task') return
    assert.equal(taskBlock.tasks?.length, 2)
    assert.equal(taskBlock.tasks?.[0]?.label, 'easy')
    assert.equal(taskBlock.tasks?.[0]?.total?.rate.text, '100%')
    assert.equal(taskBlock.tasks?.[1]?.label, 'hard')
    assert.equal(taskBlock.tasks?.[1]?.total?.rate.text, '0%')
    assert.equal(taskBlock.breakdown[0]?.rate?.text, '91%')
    assert.equal(taskBlock.breakdown[0]?.taskRate?.text, '50%')

    const md = runReportMarkdown(report)
    assertCleanMarkdown(md)
    assert.match(md, /\*\*91% passed\*\*/)
    assert.match(md, /Task-averaged: 50% across 2 tasks\./)
    assert.match(md, /## By task/)
    assert.match(md, /\| easy \| 100% \| 10 of 10 \|/)
    assert.match(md, /\| hard \| 0% \| 0 of 1 \|/)
    assert.match(md, /\| Coding harness \| Pass rate \| Task avg \|/)

    // Explicit metric: 'task-pass-rate' promotes equal-weight taskRate to lead while keeping pooled visible.
    e.metric = 'task-pass-rate'
    const taskLed = buildRunReport(record, { links: { base: './' } })
    assert.doesNotThrow(() => runReportSchema.parse(taskLed))
    const rollupRow = taskLed.rollup?.rows.find((r) => r.evalId === e.key)
    assert.ok(rollupRow?.result)
    assert.equal(rollupRow.primary, '50% passed (task avg)')
    assert.equal(headlineResultText(rollupRow.result), rollupRow.primary)
    const taskLedMd = runReportMarkdown(taskLed)
    assertCleanMarkdown(taskLedMd)
    assert.match(taskLedMd, /\*\*50% passed \(task avg\)\*\*/)
    assert.match(taskLedMd, /pooled 91%/)
    assert.match(taskLedMd, /\| Coding harness \| Task avg \| Pass rate \|/)
  })

  test('multi-task contrasts preserve pooled delta and expose taskDelta and 0%-passing brokenTasks', () => {
    const record = cloneRecord('with-layouts')
    const e = twoVariants(record)
    const [control, v1, v2] = [
      e.cells.find((c) => c.role === 'control')!,
      ...e.cells.filter((c) => c.role === 'variant'),
    ]
    assert.ok(control && v1 && v2)
    e.cases = [
      {
        key: 'task-a',
        index: 0,
        outcome: 'pass',
        passRate: 1,
        fingerprint: 'f1',
        cells: [],
      },
      {
        key: 'task-b',
        index: 1,
        outcome: 'fail',
        passRate: 0,
        fingerprint: 'f2',
        cells: [],
      },
    ]
    const baseAttempt = structuredClone(e.attempts[0]!)
    let seq = 200
    const mk = (cellKey: string, caseKey: string, n: number, pass: boolean): AttemptRecord => ({
      ...structuredClone(baseAttempt),
      key: `${e.key} [${caseKey}] # ${cellKey}#${n}`,
      id: `${cellKey}#${caseKey}#${n}`,
      cell: cellKey,
      case: caseKey,
      n,
      seq: seq++,
      outcome: pass ? 'pass' : 'fail',
      assertions: [
        { label: 'check', matcher: 'toSucceed', status: pass ? 'pass' : 'fail', soft: false },
      ],
    })
    // v1 passes 8/8 on task-a and 0/1 on task-b; control passes 4/8 on task-a and 1/1 on task-b.
    e.attempts = [
      ...Array.from({ length: 8 }, (_, i) => mk(control.key, 'task-a', i + 1, i < 4)),
      mk(control.key, 'task-b', 1, true),
      ...Array.from({ length: 8 }, (_, i) => mk(v1.key, 'task-a', i + 1, true)),
      mk(v1.key, 'task-b', 1, false),
      ...Array.from({ length: 8 }, (_, i) => mk(v2.key, 'task-a', i + 1, false)),
      mk(v2.key, 'task-b', 1, false),
    ]
    for (const c of [control, v1, v2]) {
      const mine = e.attempts.filter((a) => a.cell === c.key)
      c.pass = mine.filter((a) => a.outcome === 'pass').length
      c.fail = mine.filter((a) => a.outcome === 'fail').length
      c.runs = mine.length
      c.passRate = c.pass / (c.pass + c.fail)
    }

    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    assert.doesNotThrow(() => runReportSchema.parse(report))
    const comp = report.evals[0]!.primary
    assert.equal(comp?.kind, 'comparison')
    if (comp?.kind !== 'comparison') return
    assert.equal(comp.tasks?.length, 2)
    const v1VsControl = comp.contrasts.find(
      (c) => c.from === (v1.variant ?? v1.environment) && c.to === control.environment,
    )
    assert.ok(v1VsControl)
    // Pooled delta is 8/9 - 5/9 = +33 pts, while task-averaged delta is 50% - 75% = -25 pts and flags task-b!
    assert.equal(v1VsControl.delta.text, '+33 pts')
    assert.equal(v1VsControl.taskDelta?.text, '-25 pts')
    assert.deepEqual(v1VsControl.brokenTasks, ['task-b'])

    const md = runReportMarkdown(report)
    assertCleanMarkdown(md)
    assert.match(md, /Task-avg delta/)
    assert.match(md, /0%-pass tasks/)
    assert.match(md, /task-b/)
  })

  test('Pass@k and Pass^k use unbiased estimators at explicit k, omit when any task has n < k with a reason, and omit on non-pass/fail evals', () => {
    // Exact check against combinatorial formulas:
    // n = 4, c = 2, k = 2 => pass@2 = 1 - C(2, 2)/C(4, 2) = 5/6; pass^2 = C(2, 2)/C(4, 2) = 1/6.
    // n = 5, c = 1, k = 2 => pass@2 = 1 - C(4, 2)/C(5, 2) = 1 - 6/10 = 0.4; pass^2 = 0.
    assert.ok(Math.abs((unbiasedPassAtK(2, 4, 2) ?? 0) - 5 / 6) < 1e-12)
    assert.ok(Math.abs((unbiasedPassHatK(2, 4, 2) ?? 0) - 1 / 6) < 1e-12)
    assert.ok(Math.abs((unbiasedPassAtK(1, 5, 2) ?? 0) - 0.4) < 1e-12)
    assert.equal(unbiasedPassHatK(1, 5, 2), 0)
    assert.equal(unbiasedPassAtK(2, 3, 4), null, 'null when n < k')

    const record = cloneRecord('with-layouts')
    const e = record.evals.find((ev) => !ev.compare && (ev.cases?.length ?? 0) >= 2)!
    e.cases = [
      { ...e.cases![0]!, key: 't1', name: undefined, label: 't1' },
      { ...e.cases![1]!, key: 't2', name: undefined, label: 't2' },
    ]
    const base = structuredClone(e.attempts[0]!)
    let seq = 300
    const mk = (caseKey: string, n: number, pass: boolean): AttemptRecord => ({
      ...structuredClone(base),
      key: `${e.key} [${caseKey}] # ${base.cell}#${n}`,
      id: `${base.cell}#${caseKey}#${n}`,
      case: caseKey,
      n,
      seq: seq++,
      outcome: pass ? 'pass' : 'fail',
      assertions: [
        { label: 'ok', matcher: 'toSucceed', status: pass ? 'pass' : 'fail', soft: false },
      ],
    })
    // t1: n = 4, c = 2; t2: n = 5, c = 1.
    e.attempts = [
      mk('t1', 1, true),
      mk('t1', 2, true),
      mk('t1', 3, false),
      mk('t1', 4, false),
      mk('t2', 1, true),
      mk('t2', 2, false),
      mk('t2', 3, false),
      mk('t2', 4, false),
      mk('t2', 5, false),
    ]

    // With explicit metric: { passAtK: 2 }, both tasks satisfy n >= 2:
    // pass@2 = (5/6 + 0.4) / 2 = 37/60 (~62%); pass^2 = (1/6 + 0) / 2 = 1/12 (~8%).
    const at2 = buildRunReport(record, {
      evals: [e.key],
      metric: { passAtK: 2 },
      links: { base: './' },
    })
    assert.doesNotThrow(() => runReportSchema.parse(at2))
    const p2 = at2.evals[0]!.headline.primary
    assert.equal(p2.kind, 'pass-rate')
    if (p2.kind !== 'pass-rate') return
    assert.equal(p2.k, 2)
    assert.ok(Math.abs((p2.passAtK?.value ?? 0) - 37 / 60) < 1e-12)
    assert.equal(p2.passAtK?.text, '62%')
    assert.ok(Math.abs((p2.passHatK?.value ?? 0) - 1 / 12) < 1e-12)
    assert.equal(p2.passHatK?.text, '8%')
    assert.equal(p2.passKOmitted, undefined)
    const mdAt2 = runReportMarkdown(at2)
    assertCleanMarkdown(mdAt2)
    assert.match(mdAt2, /\*\*62% pass@2\*\*/)
    assert.match(mdAt2, /Pass@2 62%, Pass\^2 8% \(pooled 33%\)/)
    assert.match(mdAt2, /\| Coding harness \| Pass@2 \| Pass rate \| Task avg \| Pass\^2 \|/)

    // With explicit metric: { passHatK: 5 }, t1 only has n = 4 < 5 => omitted with clear reason!
    const at5 = buildRunReport(record, {
      evals: [e.key],
      metric: { passHatK: 5 },
      links: { base: './' },
    })
    assert.doesNotThrow(() => runReportSchema.parse(at5))
    const p5 = at5.evals[0]!.headline.primary
    assert.equal(p5.kind, 'pass-rate')
    if (p5.kind !== 'pass-rate') return
    assert.equal(p5.k, 5)
    assert.equal(p5.passAtK, undefined)
    assert.equal(p5.passHatK, undefined)
    assert.equal(p5.passKOmitted, 'needs 5 trials per task (fewest has 4)')
    const taskBlock5 = at5.evals[0]!.primary
    assert.equal(taskBlock5?.kind, 'task')
    if (taskBlock5?.kind === 'task') {
      // t1 (n=4 < 5) omits pass@5, while t2 (n=5 >= 5, c=1) has pass@5 = 100%, pass^5 = 0%.
      assert.equal(taskBlock5.tasks?.[0]?.total?.passAtK, undefined)
      assert.match(taskBlock5.tasks?.[0]?.total?.passKOmitted ?? '', /needs 5 trials per task/)
      assert.equal(taskBlock5.tasks?.[1]?.total?.passAtK?.value, 1)
      assert.equal(taskBlock5.tasks?.[1]?.total?.passHatK?.value, 0)
    }
    const mdAt5 = runReportMarkdown(at5)
    assertCleanMarkdown(mdAt5)
    assert.match(mdAt5, /\*\*33% passed\*\*/, 'falls back to pooled pass rate when k is unmet')
    assert.match(mdAt5, /Pass@5 and Pass\^5 omitted: needs 5 trials per task \(fewest has 4\)\./)

    // Non-pass/fail evaluation (pure choice without assertions) omits Pass@k / Pass^k even when requested.
    const ungraded = cloneRecord('with-layouts')
    const choiceEval = ungraded.evals.find((ev) => !ev.compare)!
    choiceEval.cases = undefined
    choiceEval.attempts = choiceEval.attempts.slice(0, 3).map((a, i) => ({
      ...a,
      case: undefined,
      outcome: 'pass',
      assertions: [],
      judgements: [],
      observations: [],
      answers: [
        {
          question: 'Which client?',
          choices: ['fetch', 'axios'],
          choice: i === 0 ? 'axios' : 'fetch',
          text: 'picked',
          input: null,
        },
      ],
    }))
    const choiceReport = buildRunReport(ungraded, {
      evals: [choiceEval.key],
      metric: { passAtK: 2 },
      links: { base: './' },
    })
    assert.doesNotThrow(() => runReportSchema.parse(choiceReport))
    assert.equal(choiceReport.evals[0]!.headline.primary.kind, 'choice')
    assert.equal(choiceReport.evals[0]!.primary, null)
    assert.doesNotMatch(runReportMarkdown(choiceReport), /Pass@2|Pass\^2/)
  })

  test('effort summarizes passing attempts only on pass/fail evals, returns null at 0 passes, keeps counted on ungraded, and computes costPerSuccess', () => {
    const record = cloneRecord('with-layouts')
    const e = record.evals.find(
      (ev) => ev.compare && ev.cells.filter((c) => c.role === 'variant').length === 1 && !ev.cases,
    )!
    assert.ok(e)
    const control = e.cells.find((c) => c.role === 'control')!
    const variant = e.cells.find((c) => c.role === 'variant')!
    const controlAttempts = e.attempts.filter((a) => a.cell === control.key)
    const variantAttempts = e.attempts.filter((a) => a.cell === variant.key)
    assert.equal(controlAttempts.length, 4)
    assert.equal(variantAttempts.length, 4)

    // Control: 1 pass ($0.25, 1000 tokens, 10s, 4 tools) and 3 fast cheap fails ($0.25, $0.50, $1.00; 10 tokens; 1s; 1 tool).
    // Total control cost = $2.00 across 4 counted attempts, 1 pass => costPerSuccess = $2.00, passing median cost = $0.25!
    const controlCosts = [0.25, 0.25, 0.5, 1.0]
    controlAttempts.forEach((a, i) => {
      const pass = i === 0
      a.outcome = pass ? 'pass' : 'fail'
      a.assertions = [
        { label: 'check', matcher: 'toSucceed', status: pass ? 'pass' : 'fail', soft: false },
      ]
      a.usage = {
        input: pass ? 900 : 8,
        output: pass ? 100 : 2,
        cacheRead: 0,
        cacheWrite: 0,
        reasoning: null,
      }
      a.timings = { ...a.timings, agentMs: pass ? 10_000 : 1000 }
      a.activity = { ...a.activity, tools: pass ? 4 : 1 }
      a.cost = { usd: controlCosts[i]!, basis: 'reported', source: 'fixture' }
    })

    // Variant: 0 passes out of 4 counted attempts ($0.10 each) => effort measures and costPerSuccess are all null!
    variantAttempts.forEach((a) => {
      a.outcome = 'fail'
      a.assertions = [{ label: 'check', matcher: 'toSucceed', status: 'fail', soft: false }]
      a.usage = { input: 50, output: 10, cacheRead: 0, cacheWrite: 0, reasoning: null }
      a.timings = { ...a.timings, agentMs: 500 }
      a.activity = { ...a.activity, tools: 1 }
      a.cost = { usd: 0.1, basis: 'reported', source: 'fixture' }
    })

    assert.equal(costPerSuccess(controlAttempts), 2)
    assert.equal(costPerSuccess(variantAttempts), null)

    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    assert.doesNotThrow(() => runReportSchema.parse(report))
    const comp = report.evals[0]!.primary
    assert.equal(comp?.kind, 'comparison')
    if (comp?.kind !== 'comparison') return
    const baseRow = comp.summary.find((r) => r.arm === control.environment)!
    const varRow = comp.summary.find((r) => r.arm === (variant.variant ?? variant.environment))!

    // Baseline effort reflects ONLY the 1 passing attempt (1,000 tokens, 4 tools, 10s, $0.25), not the 3 fails!
    assert.equal(baseRow.measures.tokens.value?.n, 1)
    assert.equal(baseRow.measures.tokens.value?.median.value, 1000)
    assert.equal(baseRow.measures.toolCalls.value?.median.value, 4)
    assert.equal(baseRow.measures.agentMs.value?.median.value, 10_000)
    assert.equal(baseRow.measures.costUsd.value?.median.value, 0.25)
    assert.equal(baseRow.costPerSuccess?.value, 2)
    assert.equal(baseRow.costPerSuccess?.text, '$2.00')
    assert.equal(baseRow.costPerSuccessDelta, null)

    // Variant (0 passes) has null measures and null costPerSuccess — never fake zeros!
    assert.equal(varRow.measures.tokens.value, null)
    assert.equal(varRow.measures.toolCalls.value, null)
    assert.equal(varRow.measures.agentMs.value, null)
    assert.equal(varRow.measures.costUsd.value, null)
    assert.equal(varRow.costPerSuccess, null)
    assert.equal(varRow.costPerSuccessDelta, null)

    // Attempt index still preserves each individual failed attempt's own usage!
    for (const fa of variantAttempts) {
      const idxRow = report.attempts.find((r) => r.key === fa.key)!
      assert.equal(idxRow.tokens.value, 60)
      assert.equal(idxRow.agentMs.value, 500)
      assert.equal(idxRow.toolCalls.value, 1)
    }

    const md = runReportMarkdown(report)
    assertCleanMarkdown(md)
    assert.match(md, /\| Cost \| Cost per success \|/)
    assert.match(md, /\$0\.25 \| \$2\.00 \|/)

    // Now let variant pass 4/4 at $0.125 each (total $0.50, costPerSuccess = $0.125 => -94% vs $2.00).
    variantAttempts.forEach((a) => {
      a.outcome = 'pass'
      a.assertions = [{ label: 'check', matcher: 'toSucceed', status: 'pass', soft: false }]
      a.cost = { usd: 0.125, basis: 'reported', source: 'fixture' }
    })
    const report2 = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    const comp2 = report2.evals[0]!.primary
    assert.equal(comp2?.kind, 'comparison')
    if (comp2?.kind === 'comparison') {
      const varRow2 = comp2.summary.find((r) => r.arm === (variant.variant ?? variant.environment))!
      assert.equal(varRow2.costPerSuccess?.value, 0.125)
      assert.equal(varRow2.costPerSuccessDelta?.text, '-94%')
    }

    // Ungraded numeric-observation eval summarizes all counted attempts as before.
    const ungradedRec = cloneRecord('with-layouts')
    const numEval = ungradedRec.evals.find((ev) => !ev.compare)!
    numEval.cases = undefined
    numEval.attempts = numEval.attempts.slice(0, 2).map((a, i) => ({
      ...a,
      case: undefined,
      outcome: 'pass',
      assertions: [],
      judgements: [],
      answers: [],
      observations: [{ name: 'bundle_kb', value: i === 0 ? 40 : 60 }],
      usage: { input: 200 * (i + 1), output: 50, cacheRead: 0, cacheWrite: 0, reasoning: null },
    }))
    const numReport = buildRunReport(ungradedRec, { evals: [numEval.key], links: { base: './' } })
    assert.equal(numReport.evals[0]!.headline.primary.kind, 'measure')
    if (numReport.evals[0]!.headline.primary.kind === 'measure') {
      assert.equal(numReport.evals[0]!.headline.primary.spread.n, 2)
      assert.equal(numReport.evals[0]!.headline.primary.spread.median.value, 50)
    }
  })

  test('small-sample 100% caveats pair Wilson CIs with no-failures framing, and all-100% comparisons flag saturation', () => {
    const record = cloneRecord('with-layouts')
    const e = twoVariants(record)
    const [control, v1, v2] = [
      e.cells.find((c) => c.role === 'control')!,
      ...e.cells.filter((c) => c.role === 'variant'),
    ]
    assert.ok(control && v1 && v2)

    // Make all 3 arms pass 100% (4 of 4 each), with v1 cutting tokens by 50% (tied-ceiling).
    for (const a of e.attempts) {
      a.outcome = 'pass'
      a.assertions = [{ label: 'check', matcher: 'toSucceed', status: 'pass', soft: false }]
      const isV1 = a.cell === v1.key
      a.usage = {
        input: isV1 ? 400 : 800,
        output: 100,
        cacheRead: 0,
        cacheWrite: 0,
        reasoning: null,
      }
    }
    const tiedReport = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    assert.doesNotThrow(() => runReportSchema.parse(tiedReport))
    const tiedSec = tiedReport.evals[0]!
    assert.equal(tiedSec.headline.saturated, true)
    assert.equal(tiedSec.headline.primary.kind, 'tied-ceiling')
    if (tiedSec.headline.primary.kind === 'tied-ceiling') {
      assert.equal(tiedSec.headline.primary.saturated, true)
    }
    assert.match(tiedSec.headline.foot, /No failures in 12 trials across 3 arms/)
    assert.match(tiedSec.headline.foot, /95% Wilson CI 51% to 100%/)
    assert.match(tiedSec.headline.foot, /Saturated: every arm hit 100% across all tasks/)
    assert.match(
      tiedSec.headline.foot,
      /catches regressions; add harder tasks to separate variants/,
    )
    const tiedComp = tiedSec.primary
    assert.equal(tiedComp?.kind, 'comparison')
    if (tiedComp?.kind === 'comparison') {
      assert.equal(tiedComp.saturated, true)
      assert.match(tiedComp.saturationNote ?? '', /catches regressions/)
    }
    const tiedMd = runReportMarkdown(tiedReport)
    assertCleanMarkdown(tiedMd)
    assert.match(tiedMd, /Saturated: every arm hit 100% across all tasks/)

    // Also when all arms hit 100% AND effort is identical (lift ±0 pts path, not tied-ceiling): still flags saturation!
    for (const a of e.attempts) {
      a.usage = { input: 500, output: 100, cacheRead: 0, cacheWrite: 0, reasoning: null }
      a.timings = { ...a.timings, agentMs: 2000 }
      a.activity = { ...a.activity, tools: 2, fileEdits: 1 }
    }
    const flatCeiling = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    assert.doesNotThrow(() => runReportSchema.parse(flatCeiling))
    assert.equal(flatCeiling.evals[0]!.headline.primary.kind, 'lift')
    assert.equal(flatCeiling.evals[0]!.headline.saturated, true)
    assert.match(flatCeiling.evals[0]!.headline.foot, /No failures in 4 vs 4 trials/)
    assert.match(flatCeiling.evals[0]!.headline.foot, /Saturated: every arm hit 100%/)

    // Canary: when v2 drops below 100% (even if control and v1 are 100%), comparison is NOT saturated!
    const v2Attempt = e.attempts.find((a) => a.cell === v2.key)!
    v2Attempt.outcome = 'fail'
    v2Attempt.assertions = [{ label: 'check', matcher: 'toSucceed', status: 'fail', soft: false }]
    const notSaturated = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    assert.equal(notSaturated.evals[0]!.headline.saturated, undefined)
    if (notSaturated.evals[0]!.primary?.kind === 'comparison') {
      assert.equal(notSaturated.evals[0]!.primary.saturated, undefined)
    }
  })

  test('metric option cascades from config through profile defaults, groups, and evals', () => {
    const cfg = resolveConfig(
      {
        metric: 'task-pass-rate',
        profiles: {
          reliability: { defaults: { metric: { passHatK: 3 } } },
        },
      },
      process.cwd(),
    )
    assert.equal(cfg.metric, 'task-pass-rate')
    const base = {
      harness: cfg.harness,
      sandbox: cfg.sandbox,
      environments: cfg.environments,
      compare: undefined,
      runs:
        cfg.runs === undefined
          ? undefined
          : typeof cfg.runs === 'number'
            ? cfg.runs
            : cfg.runs.bestOf,
      bestOf: undefined,
      gate: cfg.gate,
      metric: cfg.metric,
      env: cfg.env,
      egress: {},
      judge: cfg.judge,
      capture: cfg.capture,
      question: cfg.question,
      questions: [],
      timeout: undefined,
      snapshot: cfg.snapshot,
      tags: [],
      revision: undefined,
      pin: [],
    }
    const inherited = cascade(base, [{ options: {}, where: 'evaluate("e")' }], 'evaluate("e")')
    assert.equal(inherited.resolved.metric, 'task-pass-rate')
    const overridden = cascade(
      base,
      [
        { options: { metric: { passHatK: 4 } }, where: 'group("g")' },
        { options: { metric: { passAtK: 3 } }, where: 'evaluate("e")' },
      ],
      'evaluate("e")',
    )
    assert.deepEqual(overridden.resolved.metric, { passAtK: 3 })
  })

  test('report footers count sample sizes in trials and never in attempts or runs', () => {
    for (const entry of corpusEntries()) {
      const file = entry.runs.at(-1)?.file
      if (!file) continue
      const record = readableRecord(JSON.parse(readFileSync(file, 'utf8')) as RunRecord)
      const report = buildRunReport(record, { links: { base: './' } })
      for (const sec of report.evals) {
        assert.doesNotMatch(
          sec.headline.foot,
          /\b(counted )?attempts?\b|\bruns?\b|\bn\s*=/i,
          `${entry.name} / ${sec.name}: ${sec.headline.foot}`,
        )
      }
    }

    const layouts = loadCorpusRun('with-layouts')
    const report = buildRunReport(layouts, { links: { base: './' } })
    const byName = new Map(report.evals.map((s) => [s.name, s.headline.foot]))
    assert.match(byName.get('greets in the house style') ?? '', /^4 vs 4 trials\./)
    assert.match(
      byName.get('greets in the house style') ?? '',
      /No failures in 4 trials on with-skill/,
    )
    assert.match(byName.get('greets once') ?? '', /^1 vs 1 trials\./)
    assert.match(
      byName.get('greets once') ?? '',
      /1 trial per side is below 4, so this cannot come back helped or made worse\./,
    )
    assert.match(
      byName.get('writes greet.js') ?? '',
      /^No failures in 1 trial on 1 assertion \(95% Wilson CI 21% to 100%\);/,
    )
    assert.match(byName.get('greets in French') ?? '', /^0 of 1 trial passed on all 2 assertions\./)
    assert.equal(byName.get('reads the fixture repo'), 'No trial reported usage.')

    // Non-pass/fail shapes also count sample sizes in trials in their footers.
    const choiceRec = cloneRecord('with-layouts')
    const choiceEv = choiceRec.evals.find((ev) => !ev.compare)!
    choiceEv.cases = undefined
    choiceEv.attempts = choiceEv.attempts.slice(0, 3).map((a, i) => ({
      ...a,
      case: undefined,
      assertions: [],
      judgements: [],
      observations: [],
      answers: [
        {
          question: 'Which client?',
          choices: ['fetch', 'axios'],
          choice: i === 0 ? null : 'fetch',
          text: i === 0 ? '' : 'fetch',
          input: null,
        },
      ],
    }))
    const choiceFoot = buildRunReport(choiceRec, { evals: [choiceEv.key] }).evals[0]!.headline.foot
    assert.equal(choiceFoot, '3 trials, 1 without a pick.')

    const obsRec = cloneRecord('with-layouts')
    const obsEv = obsRec.evals.find((ev) => !ev.compare)!
    obsEv.cases = undefined
    obsEv.attempts = obsEv.attempts.slice(0, 2).map((a, i) => ({
      ...a,
      case: undefined,
      assertions: [],
      judgements: [],
      answers: [],
      observations: [{ name: 'bundle_kb', value: i === 0 ? 40 : 60 }],
    }))
    const obsFoot = buildRunReport(obsRec, { evals: [obsEv.key] }).evals[0]!.headline.foot
    assert.equal(obsFoot, '2 trials, interquartile range 45 to 55.')

    const textRec = cloneRecord('with-layouts')
    const textEv = textRec.evals.find((ev) => !ev.compare)!
    textEv.cases = undefined
    textEv.answers = undefined
    textEv.attempts = textEv.attempts.slice(0, 2).map((a, i) => ({
      ...a,
      case: undefined,
      assertions: [],
      judgements: [],
      observations: [],
      answers: [{ question: 'Why?', text: `Reason ${i + 1}`, choice: null, input: null }],
    }))
    const textFoot = buildRunReport(textRec, { evals: [textEv.key] }).evals[0]!.headline.foot
    assert.equal(textFoot, '2 of 2 trials answered. Showing 1 representative answer.')
  })
})
