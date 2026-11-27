import { defineConfig, regression } from 'reeval'
import { openrouter, vercel, vertex } from 'reeval/gateway'
import { boat } from 'reeval/provider/boat'
import { docker } from 'reeval/sandbox'
import { contractHarness } from './harness.ts'

// The harness contract: every real harness runs these evals in Docker, on boat()'s machines with
// REEVAL_CONTRACT_SANDBOX=boat, or there with an image recipe with boat-image. contract.test.ts
// picks the harness, model and gateway (REEVAL_CONTRACT_HARNESS, REEVAL_CONTRACT_MODEL,
// REEVAL_CONTRACT_GATEWAY) from its table.
export default defineConfig({
  agents: contractHarness(),
  // Every check gates, so a broken behavior fails its eval and the run.
  target: regression(),
  ...(process.env.REEVAL_CONTRACT_SANDBOX === 'boat' ? { provider: boat() } : {}),
  ...(process.env.REEVAL_CONTRACT_SANDBOX === 'boat-image'
    ? { provider: boat(), sandbox: docker({ from: 'debian:bookworm-slim', id: 'boat-image' }) }
    : {}),
  // REEVAL_CONTRACT_GATEWAY: the row's gateway alone, so the plan refuses rather than falls back.
  ...(process.env.REEVAL_CONTRACT_GATEWAY === 'vercel' ? { gateway: [vercel()] } : {}),
  ...(process.env.REEVAL_CONTRACT_GATEWAY === 'openrouter' ? { gateway: [openrouter()] } : {}),
  ...(process.env.REEVAL_CONTRACT_GATEWAY === 'vertex' ? { gateway: [vertex()] } : {}),
  // No retries, one trial per cell: a failure is a failure (see README, flake policy).
  trials: 1,
  timeout: '4m',
  // The hard cap: the 32 evals in evals/, and nothing a stray eval file could add.
  budget: { trials: 32 },
})
