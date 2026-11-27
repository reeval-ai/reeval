import { basename } from 'node:path'
import {
  type TrialContext,
  defineGrader,
  type EvalSpec,
  type GraderContext,
  type JSONValue,
} from 'reeval'
import { notInDiff, observed, succeeded } from 'reeval/graders'
import { brokenProject } from './environments.ts'

const CAUSES = [
  'agent-error',
  'check-path',
  'judge-threshold',
  'skill-missing',
  'flaky-check',
  'setup-step',
  'egress-blocked',
  'timeout',
] as const

type Cause = (typeof CAUSES)[number]

export const intro =
  'This is a reeval project (reeval is an eval runner for coding agents; its CLI is `reeval`, already installed, and it runs here without Docker or API keys).'

export const fixTask = `${intro} Its latest run failed.

Find out why, and fix the project so that \`reeval run\` passes. Fix the cause: don't delete or skip checks, and leave reeval.config.ts alone (it is the agent under test and its judge).

Then write answer.json: {"cause": "<one of ${CAUSES.join(', ')}>", "evidence": "<one sentence>"}.`

/**
 * Each fixture fails for one known reason; `keeps` are what its eval file must still say after the
 * fix, its target included.
 */
export const fixtures: Array<{ fixture: string; cause: Cause; file: string; keeps: RegExp[] }> = [
  {
    fixture: 'check-path',
    cause: 'check-path',
    file: 'evals/greet.eval.ts',
    keeps: [
      /hasFile\(\s*'lib\/greet\.js'[^)]*required: true/,
      /'Hello, Ada!'/,
      /target: regression\(\)/,
    ],
  },
  {
    fixture: 'judge-threshold',
    cause: 'judge-threshold',
    file: 'evals/readme.eval.ts',
    keeps: [/judge\(/, /mostly: 0\.8/, /target: regression\(/],
  },
  {
    fixture: 'skill-missing',
    cause: 'skill-missing',
    file: 'evals/greet.eval.ts',
    keeps: [/'Ahoy, Ada!'/, /target: regression\(\)/],
  },
  {
    fixture: 'flaky-check',
    cause: 'flaky-check',
    file: 'evals/report.eval.ts',
    keeps: [/trials: 6/, /dist\/report\.txt/, /target: regression\(\)/],
  },
  {
    fixture: 'setup-step',
    cause: 'setup-step',
    file: 'evals/count.eval.ts',
    keeps: [/=== '3'/, /target: regression\(\)/],
  },
]

export const parseAnswer = (text: string | null): Record<string, unknown> => {
  try {
    return JSON.parse(text ?? '') as Record<string, unknown>
  } catch {
    return {}
  }
}

/** The toolkit's eval files, by eval name: an answer may name an eval either way. */
const evalFiles: Record<string, string> = {
  'chunks an array': 'chunk.eval.ts',
  'clamps a number': 'clamp.eval.ts',
  'pads a string': 'pad.eval.ts',
  'builds the report': 'report.eval.ts',
  'sums a list': 'sum.eval.ts',
  'title-cases a phrase': 'title-case.eval.ts',
  'removes duplicates': 'uniq.eval.ts',
}

/** The eval names an answer lists, matched loosely: `pad`, `pad.eval.ts` and `pads a string` name `pads a string`. */
export const named = (value: unknown, names: string[]) => {
  const given = Array.isArray(value) ? value.map((g) => String(g).toLowerCase()) : []
  return names.filter((name) =>
    given.some(
      (g) => g.includes(name) || g.includes((evalFiles[name] ?? name).replace(/\.eval\.ts$/, '')),
    ),
  )
}

// A study, not a gate: the numbers are each side's pass rate, the lift and the effort.
export const study = (fixture: string, history?: { base: string }) => {
  const { baseline, variant } = brokenProject(fixture, history)
  return { compare: { baseline: baseline, variants: [variant] } }
}

/** One field of answer.json as the agent left it; null when there's no answer.json or field. */
export const answer = async (c: GraderContext, field: string) =>
  (parseAnswer(await c.readFile('answer.json').catch(() => null))[field] ?? null) as JSONValue

const namesCause = (cause: Cause) =>
  defineGrader(`names-${cause}`, {
    files: ['answer.json'],
    grade: (c) => answer(c, 'cause'),
    score: (given) => (given === cause ? 1 : 0),
  })

/** `reeval run`, which the task runs once the agent is done. */
const runPasses = succeeded('reeval run')
const leavesConfig = notInDiff('reeval.config.ts', { required: true })

/** What weakens an eval file's checks. */
export const WEAKENED = /\bskip:|capability\(/g

/** The eval file's checks that are gone, and what weakens them; passes with none. */
const keepsChecks = (file: string, keeps: RegExp[], weakened = WEAKENED) =>
  defineGrader(`keeps-the-checks-in-${basename(file)}`, {
    files: [file],
    grade: async (c) => {
      const source = await c.readFile(file).catch(() => '')
      return [
        ...keeps.filter((keep) => !keep.test(source)).map(String),
        ...(source.match(weakened) ?? []),
      ]
    },
    score: (missing) => (missing.length === 0 ? 1 : 0),
    required: true,
  })

/** The task of a fixture to fix: the agent's turn, then the project's own run. */
export const fixesARun =
  (prompt: string): EvalSpec['task'] =>
  async (c) => {
    await c.send(prompt)
    await c.exec('node_modules/.bin/reeval run --ui plain', { label: 'reeval run' })
  }

/** A fixture that fails for one known reason: the agent finds it and fixes the project. */
export function debugsARun(fixture: (typeof fixtures)[number]['fixture']): EvalSpec {
  const { cause, file, keeps } = fixtures.find(
    (f) => f.fixture === fixture,
  ) as (typeof fixtures)[number]
  return {
    ...study(fixture),
    graders: [namesCause(cause), runPasses, leavesConfig, keepsChecks(file, keeps)],
    task: fixesARun(fixTask),
  }
}

/** big-record's fix: its run's export check, whose target is the config's. */
export const fixesTheExport = [
  namesCause('check-path'),
  runPasses,
  leavesConfig,
  keepsChecks(
    'evals/export.eval.ts',
    [/hasFile\(\s*'lib\/export\.js'[^)]*required: true/, /c\.exec\(joinsRows/],
    /\bskip:|target:|capability\(/g,
  ),
]

/** The prompt's lead for the projects with a git history and a recorded run per commit. */
export const history = `${intro} Every commit's run is recorded in its history, in evals/.history.`
export const toolkit = { base: 'toolkit' }

/**
 * Observes the records the agent changed as `touched-records`: it must leave them as they are,
 * though new runs it records are fine.
 */
export const observeHistory = async (c: TrialContext) =>
  c.observe(
    'touched-records',
    (await c.exec('git status --porcelain -- evals/.history')).stdout
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('??')),
  )

export const leavesHistory = observed<string[]>('touched-records', (lines) => lines.length === 0, {
  name: 'leaves-the-history-alone',
  required: true,
})
