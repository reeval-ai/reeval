// Every corpus run's presentation, rendered as summary.md and as the terminal's text, holds each
// section's figures verbatim, in the one order `sectionsOf` gives, with none of FORBIDDEN_OUTPUT.
// Goldens: test/fixtures/present/<entry>/<run>/; REEVAL_UPDATE_SNAPSHOTS=1 rewrites them.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { HARNESSES } from '@reeval/agents'
import { corpusEntries } from '../scripts/schema/corpus.ts'
import type { RunRecord } from '../src/history/types.ts'
import { runReportText } from '../src/renderer/ascii.ts'
import { FORBIDDEN_OUTPUT, runReportMarkdown } from '../src/renderer/markdown.ts'
import {
  type Detail,
  HARNESS_NAMES,
  present,
  type RunPresentation,
  runPresentationSchema,
  type Section,
  sectionsOf,
  sectionTexts,
} from '../src/view/present/index.ts'
import { readableRecord } from '../src/view/record.ts'
import { buildRunReport } from '../src/view/report/index.ts'

const UPDATE = !!process.env.REEVAL_UPDATE_SNAPSHOTS
const GOLDENS = fileURLToPath(new URL('fixtures/present/', import.meta.url))

function holds(name: string, p: RunPresentation, detail: Detail, out: string, seen: Section[]) {
  assert.deepEqual(
    seen.map((s) => s.id),
    sectionsOf(p, detail).map((s) => s.id),
    `${name}: sections in order`,
  )
  for (const f of FORBIDDEN_OUTPUT) assert.doesNotMatch(out, f.pattern, `${name}: ${f.name}`)
  const text = out.replace(/\\\|/g, '|')
  for (const s of seen) {
    for (const t of sectionTexts(p, s)) {
      assert.ok(text.includes(t), `${name}: ${s.id} prints ${JSON.stringify(t)}`)
      assert.doesNotMatch(t, /^(Yes|No)$/, `${name}: ${s.id}`)
    }
  }
}

function golden(file: string, actual: string) {
  if (UPDATE || !existsSync(file)) {
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, actual)
    return
  }
  assert.equal(actual, readFileSync(file, 'utf8'), file)
}

describe('presentation parity', () => {
  for (const entry of corpusEntries()) {
    for (const run of entry.runs) {
      test(`${entry.name}/${run.runId}`, () => {
        const record = readableRecord(JSON.parse(readFileSync(run.file, 'utf8')) as RunRecord)
        const p = present(buildRunReport(record, { links: { base: './' } }))
        assert.deepEqual(runPresentationSchema.parse(p), p)
        const name = `${entry.name}/${run.runId}`

        const mdSeen: Section[] = []
        const md = runReportMarkdown(p, { onSection: (s) => mdSeen.push(s) })
        holds(`${name} summary.md`, p, 'full', md, mdSeen)

        const cliSeen: Section[] = []
        const cli = runReportText(p, { onSection: (s) => cliSeen.push(s) })
        holds(`${name} terminal`, p, 'brief', cli, cliSeen)

        const verboseSeen: Section[] = []
        const verbose = runReportText(p, {
          detail: 'verbose',
          onSection: (s) => verboseSeen.push(s),
        })
        holds(`${name} terminal -v`, p, 'verbose', verbose, verboseSeen)

        const dir = join(GOLDENS, entry.name, run.runId)
        golden(join(dir, 'present.json'), `${JSON.stringify(p, null, 2)}\n`)
        golden(join(dir, 'summary.md'), md)
        golden(join(dir, 'cli.txt'), cli)
      })
    }
  }
})

describe('presentation', () => {
  test('names every harness in the catalog as the catalog does', () => {
    for (const [kind, h] of Object.entries(HARNESSES)) {
      assert.equal(HARNESS_NAMES[kind], h.name, kind)
    }
  })

  test('terminal brief is the same sections, in the same order, as summary.md', () => {
    const entry = corpusEntries().find((e) => e.name === 'with-layouts')
    const file = entry?.runs.at(-1)?.file
    assert.ok(file)
    const p = present(buildRunReport(readableRecord(JSON.parse(readFileSync(file, 'utf8')))))
    const full = sectionsOf(p, 'full').map((s) => s.id)
    const brief = sectionsOf(p, 'brief').map((s) => s.id)
    assert.deepEqual(
      brief,
      full.filter((id) => brief.includes(id)),
    )
    assert.ok(brief.length < full.length)
  })
})
