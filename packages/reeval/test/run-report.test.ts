import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { corpusEntries } from '../scripts/schema/corpus.ts'
import type { EvalEntry, RunRecord } from '../src/history/types.ts'
import { FORBIDDEN_OUTPUT, runReportMarkdown } from '../src/renderer/markdown.ts'
import type { CompareRow } from '../src/view/compare.ts'
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

  test("a remark's fix is carried as a line, the one the markdown prints", () => {
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
    const remark = report.evals[0]!.failures?.remarks[0]
    assert.equal(remark?.line, '1 run per side. Fix at evals/a.eval.ts:12: set runs: 4.')
    assert.match(
      runReportMarkdown(report),
      /^- \(concern\) 1 run per side\. Fix at evals\/a\.eval\.ts:12: set runs: 4\.$/m,
    )
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
    for (const a of ab.medianTokensByArm ?? []) {
      assert.equal(typeof a.tokens.value, 'number')
    }
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

  test('each attempt carries its failures, cost, gate and answers', () => {
    const { record, e } = onTwoHarnesses()
    const control = e.cells.find((c) => c.role === 'control')!
    control.gate = 'none'
    const [priced, unpriced] = e.attempts.filter((a) => a.seq !== null)
    assert.ok(priced && unpriced)
    priced.cost = { usd: 0.25, basis: 'reported', source: 'claude-code' }
    delete unpriced.cost
    priced.outcome = 'fail'
    priced.assertions = [
      {
        label: 'tests pass',
        labelled: true,
        matcher: 'toPass',
        status: 'fail',
        at: 'evals/a.eval.ts:12',
        message: 'tests pass: expected 0 to be 1\n\nmore detail',
      } as NonNullable<typeof priced.assertions>[number],
    ]
    priced.error = { kind: 'assertion', message: 'tests pass: expected 0 to be 1' }
    priced.answers = [
      {
        question: 'Which UI?',
        model: 'google/gemini',
        resolvedModel: 'gemini-3.8-flash',
        stateOptions: {} as never,
        choices: ['Custom', 'FirebaseUI'],
        choice: 'Custom',
        text: 'It wrote its own form.',
      },
    ]
    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    assert.doesNotThrow(() => runReportSchema.parse(report))
    const row = report.attempts.find((r) => r.key === priced.key)!
    assert.deepEqual(row.failed, [
      { label: 'tests pass', at: 'evals/a.eval.ts:12', message: 'tests pass: expected 0 to be 1' },
    ])
    assert.deepEqual(row.error, { kind: 'assertion', message: 'tests pass: expected 0 to be 1' })
    assert.deepEqual(row.cost, { usd: 0.25, text: '$0.25', basis: 'reported' })
    assert.equal(report.attempts.find((r) => r.key === unpriced.key)?.cost, null)
    assert.deepEqual(row.answers, [
      {
        question: 'Which UI?',
        model: 'gemini-3.8-flash',
        choice: 'Custom',
        text: 'It wrote its own form.',
        error: null,
      },
    ])
    const gatedOf = new Map(e.cells.map((c) => [c.key, c.gate !== 'none']))
    for (const r of report.attempts) {
      const a = e.attempts.find((x) => x.key === r.key)!
      assert.equal(r.gated, gatedOf.get(a.cell), r.id)
    }
    const comparison = report.evals[0]!.primary
    assert.ok(comparison?.kind === 'comparison')
    const baseline = comparison.arms.find((a) => a.role === 'baseline')!
    assert.equal(baseline.gated, false, 'one of its cells is ungated')
    assert.ok(comparison.arms.filter((a) => a.role === 'variant').every((a) => a.gated))
  })

  test("a failed expect counts once in the failure clusters, not again as the attempt's error", () => {
    const { record, e } = onTwoHarnesses()
    const a = e.attempts.find((x) => x.seq !== null)!
    a.outcome = 'fail'
    a.assertions = [
      {
        label: 'tests pass',
        labelled: true,
        matcher: 'toBe',
        status: 'fail',
        message: 'tests pass: expected 0 to be 1',
      } as NonNullable<typeof a.assertions>[number],
    ]
    a.error = { kind: 'assertion', message: 'tests pass: expected 0 to be 1' }
    const b = e.attempts.filter((x) => x.seq !== null)[1]!
    b.outcome = 'fail'
    b.assertions = []
    b.error = { kind: 'assertion', message: 'boom' }
    const report = buildRunReport(record, { evals: [e.key], links: { base: './' } })
    const clusters = report.evals[0]!.failures?.clusters ?? []
    const id = (key: string) => report.attempts.find((r) => r.key === key)!.id
    const citing = (key: string) =>
      clusters.filter((c) => c.attempts.some((ref) => ref.id === id(key))).map((c) => c.kind)
    assert.deepEqual(citing(a.key), ['assertion'])
    const shown = clusters.find((c) => c.kind === 'assertion' && c.label === 'tests pass')
    assert.equal(shown?.message, 'tests pass: expected 0 to be 1', 'its message moves onto it')
    assert.deepEqual(citing(b.key), ['error'], 'an error with no failed assertion keeps its own')
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
