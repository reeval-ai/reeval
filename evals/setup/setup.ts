import { type AttemptContext, expect } from 'reeval'
import { arms, type Target } from './environments.ts'

/** The pre-release reeval the sandbox has; the user would install it from npm. */
export const INSTALL =
  ' (reeval is pre-release here: install it with `npm i -D ~/reeval.tgz`, or the same with the ' +
  "project's package manager, instead of from npm. This machine has no Docker.)"

type Plan = {
  totals: { evals: number; cells: number }
  evals: { name: string; cells: { role: string }[] }[]
}

async function plan(c: AttemptContext): Promise<Plan | null> {
  const r = await c.exec('./node_modules/.bin/reeval run --dry-run --json 2>/dev/null')
  try {
    return r.exitCode === 0 ? (JSON.parse(r.stdout) as Plan) : null
  } catch {
    return null
  }
}

/** The key each harness `reeval init` offers needs. */
export const HARNESS_KEY =
  /\b(CURSOR|ANTHROPIC|OPENAI|GEMINI|GOOGLE_GENERATIVE_AI|XAI|AI_GATEWAY)_API_KEY\b/

export const evalFiles = "find evals -name '*.eval.ts' 2>/dev/null | sort"

/** The checks every target shares, after the user has answered the agent's question. */
export async function setUp(
  c: AttemptContext,
  before: string[],
  expected: { evals: [number, number] },
) {
  const p = await plan(c)
  expect(p, '`reeval run --dry-run` plans').not.toBeNull()
  const added = (p?.totals.evals ?? 0) - before.length
  expect(added, 'adds at least one eval').toBeGreaterThanOrEqual(expected.evals[0])
  expect(added, 'adds at most three evals').toBeLessThanOrEqual(expected.evals[1])
  expect(c, 'runs reeval doctor').toHaveRun(/reeval doctor/)
  expect(c, 'never forces init').not.toHaveRun(/init[^\n]*--force/)
  return p
}

export function asksFirst(turn: { text: string }, created: string) {
  expect(turn.text, 'asks before writing evals').toMatch(/\?/)
  expect(created, 'writes no eval before the answer').toBe('')
}

export const evalList = async (c: AttemptContext) => (await c.exec(evalFiles)).stdout.trim()
export const names = (text: string) => text.split('\n').filter(Boolean)

export const target = (t: Target) => ({ compare: arms(t) })
