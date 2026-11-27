import { defineGrader, type GraderContext, type TrialContext } from 'reeval'
import { observed, ran } from 'reeval/graders'
import { execOf } from 'reeval/graders/match'
import { environments, type Target } from './environments.ts'

/** The pre-release reeval the sandbox has; the user would install it from npm. */
export const INSTALL =
  ' (reeval is pre-release here: install it with `npm i -D ~/reeval.tgz`, or the same with the ' +
  "project's package manager, instead of from npm. This machine has no Docker.)"

/** What the graders read of `reeval run --dry-run --json`: its evals, by name with their cells' roles. */
type Plan = { evals: { name: string; roles: string[] }[] }

async function plan(c: TrialContext): Promise<Plan | null> {
  const r = await c.exec('./node_modules/.bin/reeval run --dry-run --json 2>/dev/null')
  try {
    if (r.exitCode !== 0) return null
    const { evals } = JSON.parse(r.stdout) as {
      evals: { name: string; cells: { role: string }[] }[]
    }
    return { evals: evals.map((e) => ({ name: e.name, roles: e.cells.map((cell) => cell.role) })) }
  } catch {
    return null
  }
}

/** The task's `plan` observation; null when the project didn't plan. */
export const planOf = (c: GraderContext) => c.observation('plan') as Plan | null

/** The key each harness `reeval init` offers needs. */
export const HARNESS_KEY =
  /\b(CURSOR|ANTHROPIC|OPENAI|GEMINI|GOOGLE_GENERATIVE_AI|XAI|AI_GATEWAY)_API_KEY\b/

export const evalFiles = "find evals -name '*.eval.ts' 2>/dev/null | sort"

export const evalList = async (c: TrialContext) => (await c.exec(evalFiles)).stdout.trim()
export const names = (text: string) => text.split('\n').filter(Boolean)

/** The `eval-sources` exec's output: every eval file the agent left, concatenated. */
export const sourcesOf = (c: GraderContext) => execOf(c, 'eval-sources')?.stdout ?? ''

/**
 * The task every target shares: the first turn, whose `created` evals it observes, then the
 * answer, then the plan, the eval sources and how many evals were there before.
 */
export async function setUp(c: TrialContext, answer: string, before: string[] = []) {
  const first = await c.send(`Set up reeval here.${INSTALL}`)
  const created = names(await evalList(c)).filter((f) => !before.includes(f))
  c.observe('evals-before-answer', created)
  const last = await c.send(answer)
  c.observe('evals-before', before.length)
  c.observe('plan', await plan(c))
  await c.exec('cat evals/*.ts 2>/dev/null', { label: 'eval-sources' })
  return { first, last }
}

/** The checks every target shares, after the user has answered the agent's question. */
export const shared = [
  defineGrader('asks-before-writing-evals', {
    grade: (c) => /\?/.test(c.turns[0]?.text ?? ''),
  }),
  observed<string[]>('evals-before-answer', (created) => created.length === 0, {
    name: 'writes-no-eval-before-the-answer',
  }),
  defineGrader('plans', { grade: (c) => planOf(c) !== null }),
  defineGrader('adds-one-to-three-evals', {
    grade: (c) => (planOf(c)?.evals.length ?? 0) - Number(c.observation('evals-before')),
    score: (added) => (added >= 1 && added <= 3 ? 1 : 0),
  }),
  ran(/reeval doctor/, { name: 'runs-reeval-doctor' }),
  ran(/init[^\n]*--force/, { name: 'never-forces-init', score: (n) => (n === 0 ? 1 : 0) }),
  defineGrader('names-the-harness-key', {
    grade: (c) => HARNESS_KEY.test(c.turns.at(-1)?.text ?? ''),
  }),
]

export const target = (t: Target) => ({ compare: environments(t) })
