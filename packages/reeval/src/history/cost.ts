// Each turn, attempt, judge call, cell and run's cost in a record. A cost the harness or gateway
// reported wins, unless it's $0, which a harness says for a model it has no price for; else reeval
// estimates the tokens at list prices (prices.ts) and says so. A model
// with no price gets no cost, never $0, and a sum counts what it left out in `unpriced`.
import { priceFor, priceKey, tieredUsd } from '../cost.ts'
import { loadPrices, type Price, type Prices, type Tier } from '../prices.ts'
import type { CostTotal, CostUsd, TokenUsage } from '../types.ts'
import { totalTokens } from '../usage.ts'
import { sumCosts } from '../view/cost.ts'
import type { AttemptRecord, JudgmentRecord, RunRecord } from './types.ts'

/** A model's price, its long-prompt tiers and where they came from; null when there's none. */
export type Pricer = (model: string) => { price: Price; tiers?: Tier[]; source: string } | null

/** The loaded prices as a pricer; null without any. */
export function pricerOf(prices: Prices): Pricer | null {
  if (!prices.table) return null
  const { table, tiers, overlay, file, modelsDev } = prices
  const listed = 'fetchedAt' in modelsDev ? `models.dev ${modelsDev.fetchedAt.slice(0, 10)}` : null
  return (model) => {
    const own = overlay && priceFor(model, overlay)
    if (own) return { price: own, source: file ?? 'REEVAL_PRICES' }
    const key = listed && priceKey(model, table)
    if (!key) return null
    const tiered = tiers && Object.hasOwn(tiers, key) ? { tiers: tiers[key] } : {}
    return { price: table[key] as Price, ...tiered, source: listed }
  }
}

const used = (u: TokenUsage | null | undefined): u is TokenUsage => !!u && totalTokens(u) > 0
const micro = (usd: number) => Math.round(usd * 1e6) / 1e6

/**
 * The tokens at the model's price, plus what each of `calls` (its requests' own tokens, where
 * they're known) costs over that at the long-prompt tier its prompt reaches.
 */
function estimate(
  usage: TokenUsage | null | undefined,
  model: string | null | undefined,
  pricer: Pricer | null,
  calls: readonly TokenUsage[] = [],
): CostUsd | undefined {
  if (!used(usage) || !model || !pricer) return undefined
  const priced = pricer(model)
  if (!priced) return undefined
  const usd = tieredUsd(usage, priced.price, priced.tiers, calls)
  return { usd: micro(usd), basis: 'estimated', source: priced.source }
}

/** The turns' costs as the attempt's, unless some turn that used tokens has none. */
function attemptCost(a: AttemptRecord): CostUsd | undefined {
  if (a.cost) return a.cost
  if (a.reportedCostUsd) {
    return { usd: a.reportedCostUsd, basis: 'reported', source: 'openrouter' }
  }
  const total = sumCosts(a.turns.map((t) => ({ cost: t.cost, used: used(t.usage) })))
  if (!total || total.unpriced) return undefined
  return total
}

function judgmentCost(j: JudgmentRecord, pricer: Pricer | null): CostUsd | undefined {
  if (j.cost) return j.cost
  if (j.costUsd) return { usd: j.costUsd, basis: 'reported', source: 'openrouter' }
  return estimate(j.usage, j.resolvedModel ?? j.model, pricer, j.usage ? [j.usage] : [])
}

/** Whether pricing the record needs prices: some turn or judge call used tokens with no cost. */
export function needsPricing(record: RunRecord): boolean {
  return record.evals.some((e) =>
    e.attempts.some(
      (a) =>
        a.turns.some((t) => !t.cost && used(t.usage)) ||
        a.judgements.some((j) => !j.cost && !j.costUsd && used(j.usage)),
    ),
  )
}

/** The record with every cost it can have. */
export function priceRecord(record: RunRecord, pricer: Pricer | null): RunRecord {
  const attempts: AttemptRecord[] = []
  const evals = record.evals.map((e) => {
    const models = new Map(e.cells.map((c) => [c.key, c.model]))
    const priced = e.attempts.map((a) => {
      const turns = a.turns.map((t) => {
        const cost = t.cost ?? estimate(t.usage, t.model ?? models.get(a.cell), pricer, t.callUsage)
        return cost ? { ...t, cost } : t
      })
      const judgments = a.judgements.map((j) => {
        const cost = judgmentCost(j, pricer)
        return cost ? { ...j, cost } : j
      })
      const withTurns = { ...a, turns, judgements: judgments }
      const cost = attemptCost(withTurns)
      const out = cost ? { ...withTurns, cost } : withTurns
      attempts.push(out)
      return out
    })
    const cells = e.cells.map((c) => {
      const mine = priced.filter((a) => a.cell === c.key)
      const cost = totals(mine)
      return cost ? { ...c, cost } : c
    })
    return { ...e, attempts: priced, cells }
  })
  const run = totals(attempts)
  return {
    ...record,
    evals,
    cost: {
      ...record.cost,
      ...(run?.agent ? { agentUsd: run.agent } : {}),
      ...(run?.judge ? { judgeUsd: run.judge } : {}),
    },
  }
}

function totals(attempts: AttemptRecord[]): { agent?: CostTotal; judge?: CostTotal } | undefined {
  const agent = sumCosts(attempts.map((a) => ({ cost: a.cost, used: used(a.usage) })))
  const judge = sumCosts(
    attempts.flatMap((a) => a.judgements.map((j) => ({ cost: j.cost, used: used(j.usage) }))),
  )
  if (!agent && !judge) return undefined
  return { ...(agent ? { agent } : {}), ...(judge ? { judge } : {}) }
}

/**
 * The record priced at the prices loaded now, which it loads only when some part has tokens and
 * no reported cost. Prices that can't be loaded leave those parts without a cost.
 */
export async function withCosts(record: RunRecord, env = process.env): Promise<RunRecord> {
  if (!needsPricing(record)) return priceRecord(record, null)
  let prices: Prices
  try {
    prices = await loadPrices(env)
  } catch (error) {
    process.stderr.write(`warning: no cost estimates: ${(error as Error).message}\n`)
    return priceRecord(record, null)
  }
  return priceRecord(record, pricerOf(prices))
}
