import type { TrialContext, GraderContext } from 'reeval'

/** What the graders read of `reeval run --dry-run --json`. */
type Plan = {
  totals: { evals: number; cells: number; trials: number }
  evals: {
    target: { kind: string; blocking?: boolean }
    cells: { role: string; environment: string }[]
    graders: { name: string; kind: string }[]
    questions: { question: string; across: string[]; shows: string[] }[]
  }[]
}

/**
 * Runs `reeval run --dry-run --json` in the agent's project, labeled `dry-run`, and observes what
 * the graders read of it as `plan`: null when it fails.
 */
export async function dryRun(c: TrialContext) {
  const r = await c.exec('./node_modules/.bin/reeval run --dry-run --json', { label: 'dry-run' })
  let plan: Plan | null = null
  try {
    if (r.exitCode === 0) {
      const { totals, evals } = JSON.parse(r.stdout) as Omit<Plan, 'evals'> & {
        evals: (Omit<Plan['evals'][number], 'questions'> & {
          questions?: Plan['evals'][0]['questions']
        })[]
      }
      plan = {
        totals: { evals: totals.evals, cells: totals.cells, trials: totals.trials },
        evals: evals.map((e) => ({
          target: e.target,
          cells: e.cells.map(({ role, environment }) => ({ role, environment })),
          graders: e.graders.map(({ name, kind }) => ({ name, kind })),
          questions: (e.questions ?? []).map(({ question, across, shows }) => ({
            question,
            across,
            shows,
          })),
        })),
      }
    }
  } catch {}
  c.observe('plan', plan)
}

/** The task's `plan` observation; null when the project didn't plan. */
export const planOf = (c: GraderContext) => c.observation('plan') as Plan | null

/** `tsc -p .` in the agent's project, labeled `typechecks`. */
export const typecheck = (c: TrialContext) =>
  c.exec('./node_modules/.bin/tsc -p .', { label: 'typechecks' })

/** `reeval run` on the project's fake config, labeled `passes-on-the-fake-config`. */
export const runOnFake = (c: TrialContext) =>
  c.exec('./node_modules/.bin/reeval run --ui plain', { label: 'passes-on-the-fake-config' })
