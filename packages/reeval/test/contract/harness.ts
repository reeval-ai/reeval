import {
  antigravity,
  claudeCode,
  codex,
  cursor,
  fakeAgent,
  fx,
  goose,
  grokBuild,
  opencode,
  pi,
} from 'reeval/agent'
import { fakeScript } from './evals/probes.ts'

// The harness contract.test.ts picks for the run (REEVAL_CONTRACT_HARNESS, REEVAL_CONTRACT_MODEL);
// without one it's the scripted fake agent with Cursor's layout, the key-free row that checks the
// suite itself.
const defaultModel = process.env.REEVAL_CONTRACT_MODEL ?? ''

/** The shared options the option evals set, which only the real harnesses take. */
type SharedOptions = {
  instructions?: string
  systemPrompt?: string
  tools?: Array<'read' | 'write' | 'edit' | 'bash' | 'grep' | 'glob'>
  commands?: string[]
}

/**
 * The row's harness, with `effort` when it's given (the effort eval's cell), on another model when
 * one is given (the reasoning eval's), and with `options` (the option evals').
 */
export const contractHarness = (effort?: string, on?: string, options: SharedOptions = {}) => {
  // reeval checks every eval file's agents before --tag leaves any out, so the harness gets only
  // the options its row enforces (REEVAL_CONTRACT_OPTIONS); the evals that set another are left
  // out of that row by tag.
  const takes = (process.env.REEVAL_CONTRACT_OPTIONS ?? '').split(',')
  const kept = Object.fromEntries(Object.entries(options).filter(([key]) => takes.includes(key)))
  const e = { ...(effort ? { effort } : {}), ...kept } as { effort?: string }
  const model = on || defaultModel
  switch (process.env.REEVAL_CONTRACT_HARNESS) {
    case 'cursor':
      // fast=false: the standard-priced variant, pinned though it is the default.
      return cursor({ model, params: { fast: 'false' }, ...e })
    case 'antigravity':
      return antigravity({ model, ...e })
    case 'claude-code':
      return claudeCode({ model, ...e })
    case 'opencode':
      return opencode({ model, ...e })
    case 'goose':
      return goose({ model, ...e })
    case 'pi':
      return pi({ model, ...e })
    case 'codex':
      return codex({ model, ...e })
    case 'grok-build':
      return grokBuild({ model, ...e })
    case 'fx':
      return fx({ model, ...e })
    default:
      return fakeAgent({ layout: 'cursor', script: [fakeScript] })
  }
}
