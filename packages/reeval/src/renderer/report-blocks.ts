// One `RunReport` block at a time as Markdown, for the chart blocks that draw a single block. The
// whole report renders from its presentation (`./markdown.ts`).

import {
  changeSideText,
  headlinePrimaryText,
  headlineResultText,
  medianWithDelta,
  proportionText,
  remarkLine,
} from '../view/report/format.ts'
import { attemptAnchorId } from '../view/report/ids.ts'
import {
  COMPARE_STATUS_LABEL,
  contrastMeasureLabel,
  DISCOVERY_SOURCE_LABEL,
  MEASURE_LABEL,
  verdictLabel,
} from '../view/report/labels.ts'
import type {
  ArmRow,
  AssertionRow,
  AttemptIndexRow,
  AttemptRef,
  BlockMarkdown,
  BreakdownRow,
  CaptureGallery,
  ChoiceBreakdown,
  ContrastRow,
  DiscoveryRate,
  EffortPivotRow,
  EvalHeadline,
  EvalSection,
  FailureClusters,
  HeadlinePrimary,
  JudgmentBreakdown,
  MeasureKey,
  PassMetricLead,
  ProvenanceState,
  QualitativeAnswers,
  RegressionChanges,
  RosterRow,
  RunHeader,
  TaskCell,
  TaskResults,
  TaskRow,
  VariantComparison,
} from '../view/report/types.ts'

export type { BlockMarkdown } from '../view/report/types.ts'

const MEASURE_ORDER: MeasureKey[] = [
  'tokens',
  'toolCalls',
  'turns',
  'costUsd',
  'agentMs',
  'filesChanged',
  'linesAdded',
  'linesRemoved',
]

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function clipCell(s: string, max = 200): string {
  const t = escapeCell(s)
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return ''
  const head = `| ${headers.map(escapeCell).join(' | ')} |`
  const sep = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map((r) => `| ${r.map((c) => clipCell(c)).join(' | ')} |`).join('\n')
  return `${head}\n${sep}\n${body}`
}

function citeList(cites: AttemptRef[]): string {
  if (cites.length === 0) return ''
  return cites.map((c) => `[${c.id}](${c.href})`).join(', ')
}

function h(level: number, text: string): string {
  return `${'#'.repeat(level)} ${text}`
}

function shapeLabel(shapes: EvalSection['shapes']): string {
  const map = {
    task: 'Task',
    ab: 'A/B',
    discoverability: 'Discoverability',
    regression: 'Regression',
  } as const
  return shapes.map((s) => map[s]).join(', ')
}

function headlineBold(primary: HeadlinePrimary): string {
  return `**${headlinePrimaryText(primary)}**`
}

function headerLine(header: RunHeader): string {
  const { tally } = header
  const parts: string[] = []
  if (header.status !== 'complete') {
    parts.push(`Run stopped early (${header.status}).`)
  }
  if (tally.counted > 0) {
    parts.push(`${tally.passed} of ${tally.counted} counted attempts passed`)
  } else {
    parts.push(`${tally.counted} counted attempts`)
  }
  if (tally.reclassified > 0) {
    parts[parts.length - 1] += `, ${tally.reclassified} reclassified as infra error`
  }
  if (tally.infraError > tally.reclassified) {
    parts[parts.length - 1] += `, ${tally.infraError} infra errors`
  }
  parts[parts.length - 1] += '.'
  parts.push(`${header.wall.text} wall time.`)
  if (header.tokens) {
    parts.push(`${header.tokens.total.text} tokens (${header.tokens.cacheRead.text} cache reads).`)
  }
  if (header.cost) {
    const basis =
      header.cost.basis === 'estimated'
        ? ' (est.)'
        : header.cost.basis === 'mixed'
          ? ' (mixed)'
          : ''
    const bits = [
      header.cost.agent ? `agent ${header.cost.agent.text}` : null,
      header.cost.judge ? `judge ${header.cost.judge.text}` : null,
    ].filter(Boolean)
    if (bits.length) {
      parts.push(`${bits.join(', ')}${basis}.`)
    } else if (header.cost.total) {
      parts.push(`total ${header.cost.total.text}${basis}.`)
    } else {
      parts.push('No USD cost recorded.')
    }
  } else {
    parts.push('No USD cost recorded.')
  }
  if (header.git) {
    const dirty = header.git.dirty ? ' (dirty)' : ''
    const repo = header.git.repo ? `${header.git.repo}@` : ''
    parts.push(`${repo}${header.git.sha.slice(0, 7)}${dirty}.`)
  }
  return parts.join(' ')
}

function renderHeadline(headline: EvalHeadline, blockLevel: number): string[] {
  const lines: string[] = []
  if (headline.kicker) lines.push(headline.kicker, '')
  lines.push(headlineBold(headline.primary))
  if (headline.primary.kind === 'text' && headline.primary.lead) {
    const q = headline.primary.lead
    lines.push('')
    if (headline.primary.leadRole === 'representative') {
      lines.push(`Showing 1 of ${headline.primary.answered.k} answers as representative.`, '')
    }
    lines.push(`> ${clipCell(q.text, 400)} ([${q.attempt.id}, ${q.harness}](${q.attempt.href}))`)
  }
  lines.push('')
  lines.push(headline.foot)
  void blockLevel
  return lines
}

type PassCol = {
  id: PassMetricLead
  header: string
}

function orderedPassCols(
  metric: PassMetricLead | undefined,
  k: number | undefined,
  showTaskRate: boolean,
  showPassK: boolean,
): PassCol[] {
  const cols: PassCol[] = [
    { id: 'pass-rate', header: 'Pass rate' },
    ...(showTaskRate ? [{ id: 'task-pass-rate' as const, header: 'Task avg' }] : []),
    ...(showPassK
      ? [
          { id: 'pass@k' as const, header: k !== undefined ? `Pass@${k}` : 'Pass@k' },
          { id: 'pass^k' as const, header: k !== undefined ? `Pass^${k}` : 'Pass^k' },
        ]
      : []),
  ]
  if (!metric || metric === 'pass-rate') return cols
  const idx = cols.findIndex((c) => c.id === metric)
  if (idx <= 0) return cols
  const picked = cols[idx]!
  return [picked, ...cols.slice(0, idx), ...cols.slice(idx + 1)]
}

function passCellsFor(
  row: {
    rate: BreakdownRow['rate']
    taskRate?: BreakdownRow['taskRate']
    passAtK?: BreakdownRow['passAtK']
    passHatK?: BreakdownRow['passHatK']
  },
  cols: readonly PassCol[],
): string[] {
  return cols.map((col) => {
    switch (col.id) {
      case 'pass-rate':
        return row.rate?.text ?? 'n/a'
      case 'task-pass-rate':
        return row.taskRate?.text ?? 'n/a'
      case 'pass@k':
        return row.passAtK?.text ?? 'n/a'
      case 'pass^k':
        return row.passHatK?.text ?? 'n/a'
      default:
        return 'n/a'
    }
  })
}

function measureHeaders(showCostPerSuccess: boolean): string[] {
  const out: string[] = []
  for (const k of MEASURE_ORDER) {
    out.push(MEASURE_LABEL[k])
    if (k === 'costUsd' && showCostPerSuccess) out.push('Cost per success')
  }
  return out
}

function measureCells(
  row: BreakdownRow | ArmRow | EffortPivotRow,
  showCostPerSuccess = false,
): string[] {
  const zeroPasses = Boolean(row.rate && row.rate.n > 0 && row.rate.k === 0)
  const missingText = zeroPasses ? 'n/a' : 'not reported'
  const out: string[] = []
  for (const k of MEASURE_ORDER) {
    if ('lift' in row || 'harness' in row) {
      const m = (row as ArmRow | EffortPivotRow).measures[k]
      if (!m?.value) {
        out.push(missingText)
      } else {
        const base = medianWithDelta(m.value.median.text, m.delta)
        out.push(m.lower ? `${base}, ${m.lower.text} harnesses lower` : base)
      }
    } else {
      const s = (row as BreakdownRow).measures[k]
      out.push(s ? s.median.text : missingText)
    }
    if (k === 'costUsd' && showCostPerSuccess) {
      if (!row.costPerSuccess) {
        out.push('n/a')
      } else if ('costPerSuccessDelta' in row && row.costPerSuccessDelta) {
        out.push(medianWithDelta(row.costPerSuccess.text, row.costPerSuccessDelta))
      } else {
        out.push(row.costPerSuccess.text)
      }
    }
  }
  return out
}

function formatTaskCellText(cell: TaskCell | null | undefined): string {
  if (!cell || cell.rate.n <= 0) return 'n/a'
  const base = `${cell.rate.text} (${proportionText(cell.rate)})`
  if (cell.k !== undefined && cell.passAtK && cell.passHatK) {
    return `${base}, Pass@${cell.k} ${cell.passAtK.text}, Pass^${cell.k} ${cell.passHatK.text}`
  }
  return base
}

function taskRowsMarkdown(
  tasks: TaskRow[],
  columns: string[],
  metric: PassMetricLead | undefined,
  k: number | undefined,
  includeTotal: boolean,
): string {
  if (includeTotal && columns.length === 1) {
    const col = columns[0]!
    const showPassK = tasks.some((t) => (t.cells[col] ?? t.total)?.passAtK !== undefined)
    const passCols = orderedPassCols(metric, k, false, showPassK)
    return table(
      ['Task', ...passCols.map((c) => c.header), 'Trials'],
      tasks.map((t) => {
        const cell = t.cells[col] ?? t.total
        if (!cell) return [t.label, ...passCols.map(() => 'n/a'), 'n/a']
        return [
          t.label,
          ...passCellsFor(cell, passCols),
          cell.rate.n > 0 ? proportionText(cell.rate) : 'n/a',
        ]
      }),
    )
  }
  const headers = ['Task', ...columns, ...(includeTotal ? ['Total'] : [])]
  return table(
    headers,
    tasks.map((t) => [
      t.label,
      ...columns.map((c) => formatTaskCellText(t.cells[c])),
      ...(includeTotal ? [formatTaskCellText(t.total)] : []),
    ]),
  )
}

function assertionTable(columns: string[], rows: AssertionRow[]): string {
  const headers = ['Assertion', 'Matcher', ...columns, 'Total']
  const body = rows.map((r) => [
    r.label,
    r.matcher,
    ...columns.map((c) => r.cells[c]?.text ?? 'n/a'),
    r.total.text,
  ])
  return table(headers, body)
}

function taskMarkdown(primary: TaskResults, blockLevel: number): string[] {
  const lines: string[] = []
  if (primary.assertions.length) {
    lines.push(h(blockLevel, 'Assertions'), '')
    lines.push(assertionTable(primary.columns, primary.assertions), '')
  }
  if (primary.tasks && primary.tasks.length > 1) {
    lines.push(h(blockLevel, 'By task'), '')
    lines.push(
      taskRowsMarkdown(primary.tasks, primary.columns, primary.metric, primary.k, true),
      '',
    )
  }
  if (primary.breakdown.length) {
    const axisTitle =
      primary.axes.length === 1 && primary.axes[0] === 'harness'
        ? 'By coding harness'
        : `By ${primary.axes.join(' / ')}`
    lines.push(h(blockLevel, axisTitle), '')
    const allRows = primary.median ? [...primary.breakdown, primary.median] : primary.breakdown
    const showTaskRate = allRows.some((r) => r.taskRate != null)
    const showPassK = allRows.some((r) => r.passAtK != null)
    const showCostPerSuccess =
      primary.costReported ??
      allRows.some((r) => r.costPerSuccess != null || r.measures.costUsd != null)
    const passCols = orderedPassCols(primary.metric, primary.k, showTaskRate, showPassK)
    const headers = [
      ...primary.axes,
      ...passCols.map((c) => c.header),
      ...measureHeaders(showCostPerSuccess),
    ]
    const rows = primary.breakdown.map((r) => [
      ...r.keys,
      ...passCellsFor(r, passCols),
      ...measureCells(r, showCostPerSuccess),
    ])
    if (primary.median) {
      rows.push([
        ...primary.median.keys.map(() => '**Median**'),
        ...passCellsFor(primary.median, passCols),
        ...measureCells(primary.median, showCostPerSuccess),
      ])
    }
    lines.push(table(headers, rows), '')
    if (primary.k !== undefined && !showPassK && primary.passKOmitted) {
      lines.push(`Pass@${primary.k} and Pass^${primary.k} omitted: ${primary.passKOmitted}.`, '')
    }
  }
  return lines
}

function comparisonMarkdown(primary: VariantComparison, blockLevel: number): string[] {
  const lines: string[] = []
  lines.push(h(blockLevel, 'Baseline vs. variants'), '')
  if (primary.arms.length) {
    lines.push(
      primary.arms
        .map((a) => `- **${a.label}** (\`${a.id}\`): ${a.role}${a.change ? `: ${a.change}` : ''}`)
        .join('\n'),
      '',
    )
  }
  if (primary.uniformLead) {
    lines.push(primary.uniformLead, '')
  }
  if (primary.saturationNote) {
    lines.push(primary.saturationNote, '')
  }
  const showCostPerSuccess =
    primary.costReported ??
    primary.summary.some((r) => r.costPerSuccess != null || r.measures.costUsd != null)
  if (primary.summary.length) {
    const showTaskRate = primary.summary.some((r) => r.taskRate != null)
    const showPassK = primary.summary.some((r) => r.passAtK != null)
    const kVal = primary.k ?? primary.summary.find((r) => r.k !== undefined)?.k
    const passCols = orderedPassCols(primary.metric, kVal, showTaskRate, showPassK)
    const leadCol = passCols[0]!
    const extraPassCols = passCols.slice(1)
    const leadFirst = leadCol.id !== 'pass-rate'
    const headers = leadFirst
      ? [
          'Arm',
          leadCol.header,
          ...extraPassCols.map((c) => c.header),
          'Lift',
          'Pass-rate verdict',
          ...measureHeaders(showCostPerSuccess),
        ]
      : [
          'Arm',
          leadCol.header,
          'Lift',
          'Pass-rate verdict',
          ...extraPassCols.map((c) => c.header),
          ...measureHeaders(showCostPerSuccess),
        ]
    const rows = primary.summary.map((r) => {
      const cells = passCellsFor(r, passCols)
      return leadFirst
        ? [
            r.arm,
            ...cells,
            r.lift?.text ?? 'n/a',
            verdictLabel(r.verdict),
            ...measureCells(r, showCostPerSuccess),
          ]
        : [
            r.arm,
            cells[0]!,
            r.lift?.text ?? 'n/a',
            verdictLabel(r.verdict),
            ...cells.slice(1),
            ...measureCells(r, showCostPerSuccess),
          ]
    })
    lines.push(table(headers, rows), '')
    const omittedReason = primary.summary.find((r) => r.passKOmitted)?.passKOmitted
    if (kVal !== undefined && !showPassK && omittedReason) {
      lines.push(`Pass@${kVal} and Pass^${kVal} omitted: ${omittedReason}.`, '')
    }
  }
  if (primary.tasks && primary.tasks.length > 1) {
    lines.push(h(blockLevel, 'By task'), '')
    const cols = primary.arms.map((a) => a.label)
    lines.push(taskRowsMarkdown(primary.tasks, cols, primary.metric, primary.k, false), '')
  }
  if (primary.assertionsByArm.length) {
    lines.push(h(blockLevel, 'Assertions by arm'), '')
    const cols = primary.arms.map((a) => a.label)
    lines.push(assertionTable(cols, primary.assertionsByArm), '')
  }
  if (primary.contrasts.length) {
    lines.push(h(blockLevel, 'Pairwise contrasts'), '')
    const showHarness = primary.contrasts.some((c) => c.harness !== undefined)
    const showSandbox = new Set(primary.contrasts.map((c) => c.sandbox)).size > 1
    const showTaskDelta = primary.contrasts.some((c) => c.taskDelta !== undefined)
    const showBroken = primary.contrasts.some((c) => (c.brokenTasks?.length ?? 0) > 0)
    lines.push(
      table(
        [
          'From',
          'To',
          ...(showHarness ? ['Coding harness'] : []),
          ...(showSandbox ? ['Sandbox'] : []),
          'Measure',
          'Delta',
          ...(showTaskDelta ? ['Task-avg delta'] : []),
          'Interval',
          'Pass-rate verdict',
          ...(showBroken ? ['0%-pass tasks'] : []),
        ],
        primary.contrasts.map((c: ContrastRow) => [
          c.from,
          c.to,
          ...(showHarness ? [c.harness ?? 'n/a'] : []),
          ...(showSandbox ? [c.sandbox ?? 'n/a'] : []),
          contrastMeasureLabel(c.measure),
          c.delta.text,
          ...(showTaskDelta ? [c.taskDelta?.text ?? 'n/a'] : []),
          c.interval?.text ?? 'n/a',
          verdictLabel(c.verdict),
          ...(showBroken ? [c.brokenTasks?.length ? c.brokenTasks.join(', ') : 'none'] : []),
        ]),
      ),
      '',
    )
  }
  if (primary.effortByHarness.length) {
    lines.push(h(blockLevel, 'Effort by coding harness'), '')
    const showTaskRate = primary.effortByHarness.some((r) => r.taskRate != null)
    const showPassK = primary.effortByHarness.some((r) => r.passAtK != null)
    const kVal = primary.k ?? primary.effortByHarness.find((r) => r.k !== undefined)?.k
    const passCols = orderedPassCols(primary.metric, kVal, showTaskRate, showPassK)
    const headers = [
      'Coding harness',
      'Arm',
      ...passCols.map((c) => c.header),
      ...measureHeaders(showCostPerSuccess),
    ]
    const rows = primary.effortByHarness.map((r) => [
      r.harness === 'Median' ? '**Median**' : r.harness,
      r.arm,
      ...passCellsFor(r, passCols),
      ...measureCells(r, showCostPerSuccess),
    ])
    lines.push(table(headers, rows), '')
  }
  return lines
}

function regressionMarkdown(primary: RegressionChanges, blockLevel: number): string[] {
  const priorBits = [
    primary.prior.startedAt.slice(0, 10),
    primary.prior.gitSha ? primary.prior.gitSha.slice(0, 7) : null,
    primary.prior.branch,
    primary.prior.runId,
  ].filter(Boolean)
  const lines: string[] = [h(blockLevel, `Changes since ${priorBits.join(', ')}`), '']
  lines.push(`Prior run by ${primary.prior.author} on ${primary.prior.startedAt.slice(0, 10)}.`, '')
  if (primary.whatChanged.length) {
    lines.push(h(blockLevel + 1, 'What changed'), '')
    for (const line of primary.whatChanged) lines.push(`- ${line}`)
    lines.push('')
  }
  if (primary.rows.length) {
    lines.push(
      table(
        ['Signal', 'Kind', 'Harness', 'Prior', 'Current', 'Delta', 'Status', 'Gate'],
        primary.rows.map((r) => [
          r.signal,
          r.kind,
          r.harness ?? 'n/a',
          changeSideText(r, 'prior'),
          changeSideText(r, 'current'),
          r.delta?.text ?? 'n/a',
          COMPARE_STATUS_LABEL[r.status],
          r.gate ? 'gate' : 'ungated',
        ]),
      ),
      '',
    )
  }
  if (primary.unchanged.length) {
    lines.push(`<details><summary>Unchanged (${primary.unchanged.length})</summary>`, '')
    lines.push(
      table(
        ['Signal', 'Kind', 'Prior', 'Current'],
        primary.unchanged.map((r) => [
          r.signal,
          r.kind,
          changeSideText(r, 'prior'),
          changeSideText(r, 'current'),
        ]),
      ),
      '',
      '</details>',
      '',
    )
  }
  return lines
}

function choicesMarkdown(choices: ChoiceBreakdown[], blockLevel: number): string[] {
  const lines: string[] = []
  for (const c of choices) {
    lines.push(h(blockLevel, `Choices: ${c.question}`), '')
    lines.push(
      c.options.map((o) => `${o.label} ${o.count}`).join(', ') +
        (c.noPick ? `; ${c.noPick} without a pick` : ''),
      '',
    )
    if (c.rows.length) {
      const optionLabels = c.options.map((o) => o.label)
      const showArm = c.rows.some((r) => r.arm !== null)
      const headers = [
        ...(showArm ? ['Arm'] : []),
        'Prompt',
        'Coding harness',
        ...optionLabels,
        'Attempts',
      ]
      lines.push(
        table(
          headers,
          c.rows.map((r) => [
            ...(showArm ? [r.arm ?? 'n/a'] : []),
            r.prompt ?? 'n/a',
            r.harness,
            ...optionLabels.map((o) =>
              String(r.picks?.find((p) => p.option === o)?.k ?? r.counts[o] ?? 0),
            ),
            String(r.attempts),
          ]),
        ),
        '',
      )
    }
    if (c.passByPick.length) {
      lines.push(h(blockLevel + 1, 'Pass rate by pick'), '')
      lines.push(
        table(
          ['Pick', 'Pass rate', 'n'],
          c.passByPick.map((p) => [p.option, p.rate.text, String(p.rate.n)]),
        ),
        '',
      )
    }
  }
  return lines
}

function discoveryMarkdown(rows: DiscoveryRate[], blockLevel: number): string[] {
  const lines: string[] = []
  for (const d of rows) {
    lines.push(h(blockLevel, `Discovery: ${d.what}`), '')
    lines.push(`${d.found.text} found.`, '')
    if (d.rows.length) {
      lines.push(
        table(
          ['Coding harness', 'Found'],
          d.rows.map((r) => [r.keys.join(' / '), r.found.text]),
        ),
        '',
      )
    }
    if (d.sources.length) {
      lines.push(
        table(
          ['Source', 'Count'],
          d.sources.map((s) => [DISCOVERY_SOURCE_LABEL[s.source], String(s.count)]),
        ),
        '',
      )
    }
  }
  return lines
}

function judgmentsMarkdown(j: JudgmentBreakdown, blockLevel: number): string[] {
  const lines: string[] = []
  if (j.scores.length) {
    lines.push(h(blockLevel, 'Judgments'), '')
    const showAt = j.scores.some((s) => s.atOrAbove !== null)
    const headers = [
      'Label',
      'Question',
      'Threshold',
      'Keys',
      'Median',
      ...(showAt ? ['At or above'] : []),
    ]
    lines.push(
      table(
        headers,
        j.scores.map((s) => [
          s.label,
          s.question,
          s.threshold === null ? 'diagnostic' : String(s.threshold),
          s.keys.join(' / ') || 'n/a',
          s.spread.median.text,
          ...(showAt ? [s.atOrAbove?.text ?? 'n/a'] : []),
        ]),
      ),
      '',
    )
  }
  if (j.pairwise.length) {
    lines.push(h(blockLevel, 'Pairwise review'), '')
    lines.push(
      table(
        ['Question', 'Cut', 'A', 'B', 'A wins', 'B wins', 'Ties', 'Pairs'],
        j.pairwise.map((p) => [
          p.question,
          p.cut,
          p.a,
          p.b,
          String(p.aWins),
          String(p.bWins),
          String(p.ties),
          String(p.pairs),
        ]),
      ),
      '',
    )
    const withReasons = j.pairwise.flatMap((p) =>
      p.reasons.map((r) => ({ question: p.question, ...r })),
    )
    if (withReasons.length) {
      lines.push(h(blockLevel + 1, 'Pairwise reasons'), '')
      for (const r of withReasons) {
        const cites = citeList(r.cites)
        lines.push(`- ${clipCell(r.text, 300)}${cites ? ` (${cites})` : ''}`)
      }
      lines.push('')
    }
  }
  return lines
}

function qualitativeMarkdown(rows: QualitativeAnswers[], blockLevel: number): string[] {
  const lines: string[] = []
  for (const q of rows) {
    lines.push(h(blockLevel, `Answers: ${q.question}`), '')
    lines.push(`${q.answered.text} answered.`, '')
    const shown = q.entries.slice(0, 12)
    for (const e of shown) {
      lines.push(`- ${clipCell(e.text, 240)} ([${e.attempt.id}, ${e.harness}](${e.attempt.href}))`)
    }
    if (q.entries.length > shown.length) {
      lines.push(`- …and ${q.entries.length - shown.length} more.`)
    }
    lines.push('')
  }
  return lines
}

function capturesMarkdown(gallery: CaptureGallery, blockLevel: number): string[] {
  const lines: string[] = [h(blockLevel, 'Captures'), '']
  const showArm = gallery.rows.some((r) => r.arm !== null)
  const showNotes = gallery.rows.some((r) => r.shots.some((s) => s.meta))
  const rows: string[][] = []
  for (const r of gallery.rows) {
    for (const shot of r.shots) {
      const link = shot.href ? `[${shot.name}](${shot.href})` : `${shot.name} (not kept)`
      rows.push([
        r.harness,
        ...(showArm ? [r.arm ?? 'n/a'] : []),
        r.case ?? 'n/a',
        link,
        shot.status === null ? 'n/a' : String(shot.status),
        shot.pageErrors === null ? 'n/a' : String(shot.pageErrors),
        ...(showNotes ? [shot.meta ?? 'n/a'] : []),
        shot.attempt.id,
      ])
    }
  }
  lines.push(
    table(
      [
        'Coding harness',
        ...(showArm ? ['Arm'] : []),
        'Case',
        'Capture',
        'HTTP',
        'Page errors',
        ...(showNotes ? ['Notes'] : []),
        'Attempt',
      ],
      rows,
    ),
    '',
  )
  return lines
}

function failuresMarkdown(f: FailureClusters, blockLevel: number): string[] {
  const lines: string[] = [h(blockLevel, 'Failures and caveats'), '']
  if (f.clusters.length) {
    lines.push(
      table(
        ['Kind', 'Label', 'Message', 'At', 'Count', 'Attempts'],
        f.clusters.map((c) => [
          c.kind,
          c.label,
          c.message ?? 'n/a',
          c.at ?? 'n/a',
          c.count.text,
          citeList(c.attempts),
        ]),
      ),
      '',
    )
  }
  if (f.remarks.length) {
    lines.push(h(blockLevel + 1, 'Worth knowing'), '')
    for (const r of f.remarks) {
      lines.push(`- (${r.severity}) ${r.line ?? remarkLine(r)}`)
    }
    lines.push('')
  }
  return lines
}

function evalSectionMarkdown(section: EvalSection, single: boolean): string {
  const blockLevel = single ? 2 : 3
  const lines: string[] = []
  if (!single) {
    lines.push(h(2, section.name), '')
  }
  lines.push(`\`${section.file}\`. ${shapeLabel(section.shapes)}. ${section.design}.`, '')
  lines.push(...renderHeadline(section.headline, blockLevel), '')
  if (section.insights.length) {
    lines.push(h(blockLevel, 'Key findings'), '')
    for (const claim of section.insights) {
      const cites = citeList(claim.cites)
      lines.push(`- ${claim.text}${cites ? ` ${cites}` : ''}`)
    }
    lines.push('')
  }
  if (section.next?.length) {
    lines.push(h(blockLevel, 'Next'), '')
    for (const n of section.next) lines.push(`- ${n.at ? `At ${n.at}: ` : ''}${n.text}.`)
    lines.push('')
  }
  if (section.primary?.kind === 'task') lines.push(...taskMarkdown(section.primary, blockLevel))
  if (section.primary?.kind === 'comparison') {
    lines.push(...comparisonMarkdown(section.primary, blockLevel))
  }
  if (section.primary?.kind === 'regression') {
    lines.push(...regressionMarkdown(section.primary, blockLevel))
  }
  lines.push(...choicesMarkdown(section.choices, blockLevel))
  lines.push(...discoveryMarkdown(section.discovery, blockLevel))
  if (section.judgments) lines.push(...judgmentsMarkdown(section.judgments, blockLevel))
  lines.push(...qualitativeMarkdown(section.qualitative, blockLevel))
  if (section.captures) lines.push(...capturesMarkdown(section.captures, blockLevel))
  if (section.failures) lines.push(...failuresMarkdown(section.failures, blockLevel))
  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}

export const blockMarkdown: BlockMarkdown = {
  runHeader(header, _single) {
    void _single
    return [`# ${header.title}`, '', headerLine(header), ''].join('\n')
  },
  integrity(issues) {
    if (issues.length === 0) return ''
    const caution = issues.some((i) => i.severity === 'error')
    const lines = [
      `> [!${caution ? 'CAUTION' : 'WARNING'}]`,
      '> Integrity: read these before the results.',
      '>',
      ...issues.map((i) => {
        const cites = citeList(i.cites)
        return `> - ${i.text}${cites ? ` ${cites}` : ''}`
      }),
      '',
    ]
    return lines.join('\n')
  },
  rollup(rollup) {
    const lines: string[] = [h(2, 'Summary'), '']
    if (rollup.lead) {
      lines.push(rollup.lead.text, '')
    }
    if (rollup.rows.length) {
      lines.push(
        table(
          ['Evaluation', 'Shape / arms', 'Primary result', 'Effort'],
          rollup.rows.map((r) => [
            `[${r.name}](#${r.anchor})`,
            `${r.shapes.join(', ')}; ${r.design}`,
            r.result ? headlineResultText(r.result) : r.primary,
            r.medianTokensByArm?.some((a) => a.tokens.value !== null)
              ? r.medianTokensByArm.map((a) => `${a.arm} ${a.tokens.text}`).join('; ')
              : r.medianTokens.text,
          ]),
        ),
        '',
      )
    }
    if (rollup.findings.length) {
      lines.push(h(3, 'Key findings across evaluations'), '')
      for (const f of rollup.findings) {
        lines.push(`- ${f.text}${citeList(f.cites) ? ` ${citeList(f.cites)}` : ''}`)
      }
      lines.push('')
    }
    return lines.join('\n')
  },
  roster(rows) {
    if (rows.length === 0) return ''
    return [
      h(2, 'Coding harnesses'),
      '',
      table(
        ['Coding harness', 'Model', 'Effort', 'Served models', 'Gateway', 'Attempts'],
        rows.map((r: RosterRow) => [
          r.harness,
          r.model ?? 'n/a',
          r.effort ?? 'n/a',
          r.servedModels.join(', ') || 'n/a',
          r.gateway ?? 'n/a',
          String(r.attempts),
        ]),
      ),
      '',
    ].join('\n')
  },
  evalSection(section, single) {
    return evalSectionMarkdown(section, single)
  },
  actions(claims) {
    if (claims.length === 0) return ''
    const lines = [h(2, 'Recommended actions'), '']
    for (const c of claims) {
      lines.push(`- ${c.text}${citeList(c.cites) ? ` ${citeList(c.cites)}` : ''}`)
    }
    lines.push('')
    return lines.join('\n')
  },
  provenance(state: ProvenanceState) {
    const lines = [h(2, 'State'), '']
    const rows = state.rows.map((r) => [r.field, r.value])
    rows.push(['Artifacts', state.artifacts])
    rows.push(['Record', `[${state.record.split('/').pop()}](${state.record})`])
    if (state.context.count > 0) {
      rows.push(['Context', `${state.context.count} files`])
    }
    lines.push(table(['Field', 'Value'], rows), '')
    if (state.context.count > 5) {
      lines.push(
        `<details><summary>All ${state.context.count} context files</summary>`,
        '',
        table(
          ['Path', 'sha256'],
          state.context.files.map((f) => [f.path, f.sha256.replace(/^sha256:/, '').slice(0, 12)]),
        ),
        '',
        '</details>',
        '',
      )
    } else if (state.context.count > 0) {
      lines.push(
        table(
          ['Path', 'sha256'],
          state.context.files.map((f) => [f.path, f.sha256.replace(/^sha256:/, '').slice(0, 12)]),
        ),
        '',
      )
    }
    for (const w of state.warnings) lines.push(`> **Warning:** ${w}`, '')
    return lines.join('\n')
  },
  attemptIndex(rows: AttemptIndexRow[], _single) {
    void _single
    if (rows.length === 0) return ''
    const lines = [h(2, 'Attempt index'), '']
    lines.push(
      table(
        [
          'ID',
          'Eval',
          'Coding harness',
          'Arm / Case',
          'Outcome',
          'Tokens',
          'Agent time',
          'Tools',
          'Diff',
          'Evidence',
        ],
        rows.map((r) => {
          const evidence = [
            r.links.transcript ? `[transcript](${r.links.transcript})` : null,
            r.links.diff ? `[diff](${r.links.diff})` : null,
            ...r.links.captures.map((c) => `[${c.name}](${c.href})`),
            ...r.links.questions.map((q, i) => `[q${i + 1}](${q})`),
          ]
            .filter(Boolean)
            .join(', ')
          return [
            `<a id="${attemptAnchorId(r.key)}"></a>${r.id}`,
            r.evalId,
            r.harness,
            [r.arm, r.case].filter(Boolean).join(' / ') || 'n/a',
            r.reclassified ? `${r.outcome} (reclassified)` : r.outcome,
            r.tokens.text,
            r.agentMs.text,
            r.toolCalls.text,
            r.diff?.text ?? 'not recorded',
            evidence || 'n/a',
          ]
        }),
      ),
      '',
    )
    return lines.join('\n')
  },
}
