import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Two recorded runs of `greets` on Cursor in `evals/.history`: three counted
 * trials with usage and one judge call each, one of them with a reported cost, plus an infra
 * error that must not count.
 */
export function writePastCostRuns(root: string): void {
  const dir = join(root, 'evals', '.history')
  mkdirSync(dir, { recursive: true })
  const cell = 'cursor:composer-2.5/-/docker'
  const trial = (n: number, cacheRead: number, outcome = 'pass', usd?: number) => ({
    key: `greets # ${cell}#${n}`,
    cell,
    outcome,
    usage: { input: 40_000, cacheRead, cacheWrite: 0, output: 8_000, reasoning: null },
    ...(usd !== undefined ? { cost: { usd, basis: 'reported', source: 'openrouter' } } : {}),
    judgements: outcome === 'pass' ? [{ model: 'google/gemini-3.8-flash' }] : [],
  })
  const runs = [
    ['20261001T000000Z_aaaaaaa_test', [trial(1, 600_000), trial(2, 900_000)]],
    [
      '20261002T000000Z_bbbbbbb_test',
      [trial(1, 1_200_000, 'pass', 0.3), trial(2, 9_000_000, 'infra_error')],
    ],
  ] as const
  for (const [runId, trials] of runs) {
    const record = {
      kind: 'reeval-run',
      schemaVersion: 1,
      runId,
      status: 'complete',
      evals: [
        {
          id: 'greets',
          cells: [{ key: cell, harness: 'cursor:composer-2.5', model: 'composer-2.5' }],
          trials,
        },
      ],
    }
    writeFileSync(join(dir, `${runId}.json`), `${JSON.stringify(record, null, 2)}\n`)
  }
}

/** The cost cases' models.dev prices: what a fetch would have cached, minus Cursor's Composer. */
const MODELS_DEV = {
  'claude-sonnet-5': [2, 0.2, 2.5, 10],
  'gemini-3.8-flash': [0.75, 0.075, 0.75, 3.75],
  'gpt-5.6-luna': [0.2, 0.02, 0.25, 1.2],
}

/** The cost cases' `XDG_CACHE_HOME`, inside the copied project, so no case fetches models.dev. */
const COST_CACHE = '.cache'

/** A models.dev cache fetched just now, so the dry run uses it without fetching. */
export function seedModelsDev(root: string): void {
  const dir = join(root, COST_CACHE, 'reeval')
  mkdirSync(dir, { recursive: true })
  const cached = { fetchedAt: new Date().toISOString(), table: MODELS_DEV, tiers: {} }
  writeFileSync(join(dir, 'models-dev-prices.json'), JSON.stringify(cached))
}

/** A models.dev fetch that failed just now, so the dry run doesn't try again. */
export function seedModelsDevFailure(root: string): void {
  const dir = join(root, COST_CACHE, 'reeval')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'models-dev-failed.json'),
    JSON.stringify({ at: new Date().toISOString() }),
  )
}
