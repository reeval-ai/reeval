import { type AttemptContext, type EvalSpec, expect } from 'reeval'
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

/** Each fixture fails for one known reason; `keeps` are what its eval file must still say after the fix. */
export const fixtures: Array<{ fixture: string; cause: Cause; file: string; keeps: RegExp[] }> = [
  {
    fixture: 'check-path',
    cause: 'check-path',
    file: 'evals/greet.eval.ts',
    keeps: [/toHaveFile\(\s*'lib\/greet\.js'/, /'Hello, Ada!'/],
  },
  {
    fixture: 'judge-threshold',
    cause: 'judge-threshold',
    file: 'evals/readme.eval.ts',
    keeps: [/c\.judge\(/, /\.toPass\(\)/],
  },
  {
    fixture: 'skill-missing',
    cause: 'skill-missing',
    file: 'evals/greet.eval.ts',
    keeps: [/'Ahoy, Ada!'/],
  },
  {
    fixture: 'flaky-check',
    cause: 'flaky-check',
    file: 'evals/report.eval.ts',
    keeps: [/runs: 6/, /dist\/report\.txt/],
  },
  {
    fixture: 'setup-step',
    cause: 'setup-step',
    file: 'evals/count.eval.ts',
    keeps: [/toBe\('3'\)/],
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
  const { control, variant } = brokenProject(fixture, history)
  return { compare: { control: control, variants: [variant], gate: 'observe' as const } }
}

/** A fixture that fails for one known reason: the agent finds it and fixes the project. */
export function debugsARun(fixture: (typeof fixtures)[number]['fixture']): EvalSpec {
  const { cause, file, keeps } = fixtures.find(
    (f) => f.fixture === fixture,
  ) as (typeof fixtures)[number]
  return {
    ...study(fixture),
    task: async (c) => {
      await c.send(fixTask)

      const answer = parseAnswer(await c.readFile('answer.json'))
      expect(answer.cause, 'names the cause').toBe(cause)
      await expect(
        c.exec('node_modules/.bin/reeval run --ui plain'),
        'reeval run passes',
      ).toSucceed()

      expect(c, 'leaves the agent under test alone').not.toHaveChanged(['reeval.config.ts'])
      const source = (await c.readFile(file)) ?? ''
      const weakened = [
        ...keeps.filter((keep) => !keep.test(source)).map(String),
        ...(source.match(WEAKENED) ?? []),
      ]
      expect(weakened, 'keeps the checks').toEqual([])
    },
  }
}

/** What weakens an eval file's checks. */
export const WEAKENED = /\bskip:|gate:|passRate/g

/** The prompt's lead for the projects with a git history and a recorded run per commit. */
export const history = `${intro} Every commit's run is recorded in its history, in evals/.history.`
export const toolkit = { base: 'toolkit' }

/** Records the agent must leave as they are; new runs it records are fine. */
export const touchedRecords = async (c: AttemptContext) =>
  (await c.exec('git status --porcelain -- evals/.history')).stdout
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('??'))
