// `reeval/renderer/markdown`: a run's presentation as Markdown, the one renderer behind summary.md
// and `reeval show --md`. It prints every section `sectionsOf(p, 'full')` lists, in that order, and
// formats nothing: each figure's text comes from `present()`.
import {
  type Cite,
  type EvalPresentation,
  metricText,
  type Question,
  type RunPresentation,
  type Section,
  sectionsOf,
} from '../view/present/index.ts'

export type { BlockMarkdown } from '../view/report/types.ts'
export { blockMarkdown } from './report-blocks.ts'

/** What no text render may print. Shared by the renderers' tests and reeval-components. */
export const FORBIDDEN_OUTPUT = [
  { name: 'em or en dash', pattern: /[\u2013\u2014]/ },
  { name: 'arrow', pattern: /[\u2190-\u21ff\u27f0-\u27ff]|-[>]|=[>]/ },
  { name: 'status glyph or emoji', pattern: /[\u2713\u2717\u25cb]|\p{Extended_Pictographic}/u },
  { name: 'Yes or No value', pattern: /\|\s*(Yes|No)\s*\||\*\*(Yes|No)\b/ },
  { name: 'blank cell', pattern: /\|[ \t]*\|(?![-: |]*$)/m },
  { name: 'text dump', pattern: /^`{3}text$/m },
  { name: 'scratch path', pattern: /\.reeval\/runs\// },
  { name: 'bold pseudo-heading', pattern: /^\*\*[^*]+\.\*\*$/m },
] as const

export type RunReportMarkdownOptions = {
  /** Called with each section as it's printed, in order. */
  onSection?: (section: Section) => void
}

const ANSWERS_SHOWN = 12

function cell(s: string, max = Number.POSITIVE_INFINITY): string {
  const t =
    s
      .replace(/\|/g, '\\|')
      .replace(/\s*\n\s*/g, ' ')
      .trim() || 'n/a'
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return ''
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map((c) => cell(c)).join(' | ')} |`),
  ].join('\n')
}

/** Free text, which a table cell holds to one short line. */
const clip = (s: string) => cell(s, 200).replace(/\\\|/g, '|')

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`)

const link = (c: Cite) => `[${c.id}](${c.href})`
const links = (cites: Cite[]) => cites.map(link).join(', ')
const optional = <T>(rows: T[], pick: (r: T) => string | null) => rows.some((r) => pick(r) !== null)

function runLines(p: RunPresentation): string[] {
  const h = p.header
  const facts = [
    `${h.attempts}.`,
    `${h.wall.text} wall time.`,
    `Tokens: ${h.tokens.text}.`,
    `Cost: ${h.cost.text}.`,
    ...(h.git ? [`${h.git.text}.`] : []),
  ]
  const served = h.servedBy.map((t) => `- ${t}`)
  const meta = [
    `Run \`${h.runId}\` by ${h.author}`,
    h.date,
    `reeval ${h.reeval}`,
    ...(h.profile ? [`profile \`${h.profile}\``] : []),
    h.runs,
  ].join(', ')
  return [
    `# ${h.title}`,
    '',
    ...(h.stopped ? [`The run ${h.stopped}.`, ''] : []),
    facts.join(' '),
    '',
    sentence(meta),
    ...(served.length ? ['', ...served] : []),
  ]
}

function headLines(p: RunPresentation, e: EvalPresentation): string[] {
  const m = e.headline.metric
  const lines = [
    // A one-eval report's title is the eval's name already.
    ...(p.evals.length === 1 && p.header.title === e.name ? [] : [`## ${e.name}`, '']),
    `\`${e.file}\`. ${e.shapes.join(', ')}. ${e.design}. Verdict: ${e.verdictText}.`,
  ]
  if (m.kind === 'none') return lines
  const effect = m.kind === 'compare' && m.effectText ? `: ${m.effectText}` : ''
  lines.push('', `**${metricText(m)}${effect}**`)
  if (m.kind === 'quote' && m.text) {
    lines.push('', `> ${cell(m.text, 400)}${m.cite ? ` (${link(m.cite)})` : ''}`)
  }
  const foot = [e.headline.foot, e.headline.left ? `Left out: ${e.headline.left}` : null]
    .filter(Boolean)
    .join('. ')
  if (foot) lines.push('', sentence(foot))
  return lines
}

function questionLines(q: Question): string[] {
  switch (q.kind) {
    case 'choices':
      return [
        `#### Choices: ${q.question}`,
        '',
        table(
          ['Pick', 'Attempts'],
          q.options.map((o) => [o.label, o.count.text]),
        ),
        ...(q.noPick ? ['', sentence(q.noPick)] : []),
        '',
      ]
    case 'pairwise':
      return [
        `#### Pairwise: ${q.question}`,
        '',
        table(
          ['A', 'B', 'A won', 'B won', 'Ties'],
          [[q.a, q.b, q.aWins.text, q.bWins.text, q.ties.text]],
        ),
        '',
      ]
    case 'answers': {
      const shown = q.entries.slice(0, ANSWERS_SHOWN)
      return [
        `#### Answers: ${q.question}`,
        '',
        `${q.answered.text} answered.`,
        '',
        ...shown.map((a) => `- ${cell(a.text, 240)} (${link(a.cite)}, ${a.harness})`),
        ...(q.entries.length > shown.length
          ? [`- …and ${q.entries.length - shown.length} more.`]
          : []),
        '',
      ]
    }
  }
}

function sectionLines(p: RunPresentation, s: Section): string[] {
  const e = s.eval as EvalPresentation
  switch (s.kind) {
    case 'run':
      return runLines(p)
    case 'caveats': {
      const caution = p.caveats.some((c) => c.severity === 'error')
      return [
        `> [!${caution ? 'CAUTION' : 'WARNING'}]`,
        '> Read these before the results.',
        '>',
        ...p.caveats.map((c) => `> - ${c.text}${c.cites.length ? ` ${links(c.cites)}` : ''}`),
      ]
    }
    case 'harnesses':
      return [
        '## Coding harnesses',
        '',
        table(
          ['Coding harness', 'Served models', 'Gateway', 'Attempts'],
          p.harnesses.map((h) => [
            h.label,
            h.servedModels.join(', ') || 'n/a',
            h.gateway ?? 'n/a',
            h.attempts.text,
          ]),
        ),
      ]
    case 'eval':
      return headLines(p, e)
    case 'arms':
      return [
        '### Arms',
        '',
        table(
          ['Arm', 'Pass rate', 'Passed', 'Effect', 'Left out'],
          e.arms.map((a) => [
            a.label,
            a.rate.text,
            a.rate.of,
            a.effectText ?? a.role,
            a.left ?? 'none',
          ]),
        ),
      ]
    case 'cases': {
      const columns = e.cases[0]?.cells.map((c) => c.column) ?? []
      return [
        '### By task',
        '',
        table(
          ['Task', ...columns],
          e.cases.map((c) => [
            c.label,
            ...c.cells.map((x) => (x.rate ? `${x.rate.text} (${x.rate.of})` : 'n/a')),
          ]),
        ),
      ]
    }
    case 'attempts': {
      const arm = optional(e.attempts, (a) => a.arm)
      const kase = optional(e.attempts, (a) => a.case)
      return [
        '### Attempts',
        '',
        table(
          [
            'Attempt',
            'Coding harness',
            ...(arm ? ['Arm'] : []),
            ...(kase ? ['Case'] : []),
            'Outcome',
            'Tokens',
            'Agent time',
            'Cost',
            'Why',
          ],
          e.attempts.map((a) => [
            link(a),
            a.harness,
            ...(arm ? [a.arm ?? 'n/a'] : []),
            ...(kase ? [a.case ?? 'n/a'] : []),
            a.outcomeText,
            a.tokens.text,
            a.agentTime.text,
            a.cost.text,
            clip(a.note ?? 'n/a'),
          ]),
        ),
      ]
    }
    case 'checks': {
      const columns = e.checks[0]?.cells.map((c) => c.column) ?? []
      return [
        '### Checks',
        '',
        table(
          ['Check', 'Matcher', 'At', ...columns, 'Total'],
          e.checks.map((c) => [
            c.label,
            c.matcher,
            c.at ?? 'n/a',
            ...c.cells.map((x) => x.text),
            c.total,
          ]),
        ),
      ]
    }
    case 'failures':
      return [
        '### Failures',
        '',
        table(
          ['Kind', 'What', 'Message', 'At', 'Count', 'Attempts'],
          e.failures.map((f) => [
            f.kindText,
            f.label,
            clip(f.message ?? 'n/a'),
            f.at ?? 'n/a',
            f.where ? `${f.count.text}, ${f.where}` : f.count.text,
            links(f.attempts),
          ]),
        ),
      ]
    case 'effort':
      return [
        '### Effort',
        '',
        table(
          [
            'Group',
            'Median tokens',
            'Median tool calls',
            'Median agent time',
            'Median cost',
            'Cost per pass',
          ],
          e.effort.map((r) => [
            r.label,
            r.tokens.text,
            r.toolCalls.text,
            r.agentTime.text,
            r.cost.text,
            r.costPerPass.text,
          ]),
        ),
      ]
    case 'questions':
      return ['### Questions', '', ...e.questions.flatMap(questionLines)]
    case 'judgments': {
      const tallied = e.judgments.some((j) => j.atOrAbove !== null)
      return [
        '### Judgments',
        '',
        table(
          ['Judgment', 'Question', 'Threshold', 'Median', ...(tallied ? ['At or above'] : [])],
          e.judgments.map((j) => [
            j.label,
            j.question,
            j.threshold,
            j.median.text,
            ...(tallied ? [j.atOrAbove?.text ?? 'n/a'] : []),
          ]),
        ),
      ]
    }
    case 'discovery':
      return [
        '### Discovery',
        '',
        ...e.discovery.flatMap((d) => [
          `${d.what}: found in ${d.found.text}.`,
          '',
          table(
            ['Group', 'Found'],
            d.rows.map((r) => [r.label, r.found.text]),
          ),
          '',
        ]),
      ]
    case 'captures':
      return [
        '### Captures',
        '',
        table(
          ['Capture', 'Coding harness', 'Arm', 'Case', 'Status', 'Attempt'],
          e.captures.map((c) => [
            c.href ? `[${c.name}](${c.href})` : `${c.name} (not kept)`,
            c.harness,
            c.arm ?? 'n/a',
            c.case ?? 'n/a',
            c.status,
            link(c.attempt),
          ]),
        ),
      ]
    case 'regression': {
      const r = e.regression
      if (!r) return []
      return [
        `### Changes since ${r.prior}, ${r.priorRunId}`,
        '',
        `Prior run by ${r.priorAuthor}.`,
        '',
        ...(r.whatChanged.length
          ? ['What changed:', '', ...r.whatChanged.map((w) => `- ${w}`), '']
          : []),
        table(
          ['Signal', 'Kind', 'Coding harness', 'Prior', 'Current', 'Delta', 'Status'],
          r.rows.map((x) => [
            x.signal,
            x.kind,
            x.harness ?? 'n/a',
            x.prior,
            x.current,
            x.delta,
            x.status,
          ]),
        ),
        '',
        sentence(r.unchanged.text),
      ]
    }
    case 'next':
      return [
        '### Next',
        '',
        ...e.next.map((n) => `- ${n.at ? `At ${n.at}: ` : ''}${sentence(n.text)}`),
        ...e.remarks.map((r) => `- ${r}`),
      ]
    case 'stats':
      return ['### Statistics', '', ...e.stats.map((t) => `- ${t}`)]
    case 'actions':
      return [
        '## Recommended actions',
        '',
        ...p.actions.map((a) => `- ${a.text}${a.cites.length ? ` ${links(a.cites)}` : ''}`),
      ]
    case 'tally':
      return ['## Tally', '', sentence(`Evals: ${p.tally.text}`)]
    case 'provenance':
      return [
        '## State',
        '',
        table(
          ['Field', 'Value'],
          p.provenance.rows.map((r) => [r.field, r.value]),
        ),
        ...p.provenance.warnings.flatMap((w) => ['', `> **Warning:** ${w}`]),
      ]
    case 'attempt-index': {
      const arm = optional(p.attemptIndex, (a) => a.arm)
      const kase = optional(p.attemptIndex, (a) => a.case)
      return [
        '## Attempt index',
        '',
        table(
          [
            'ID',
            'Eval',
            'Coding harness',
            ...(arm ? ['Arm'] : []),
            ...(kase ? ['Case'] : []),
            'Outcome',
            'Tokens',
            'Agent time',
            'Tool calls',
            'Diff',
            'Evidence',
          ],
          p.attemptIndex.map((a) => [
            `<a id="${a.anchor}"></a>${a.id}`,
            a.eval,
            a.harness,
            ...(arm ? [a.arm ?? 'n/a'] : []),
            ...(kase ? [a.case ?? 'n/a'] : []),
            a.outcomeText,
            a.tokens.text,
            a.agentTime.text,
            a.toolCalls.text,
            a.diff,
            a.links.map((l) => `[${l.name}](${l.href})`).join(', ') || 'n/a',
          ]),
        ),
      ]
    }
  }
}

/** A run's presentation as standalone GFM: every section, in the order every surface uses. */
export function runReportMarkdown(
  p: RunPresentation,
  options: RunReportMarkdownOptions = {},
): string {
  const parts: string[] = []
  for (const s of sectionsOf(p, 'full')) {
    options.onSection?.(s)
    parts.push(sectionLines(p, s).join('\n'), '')
  }
  return `${parts
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`
}
