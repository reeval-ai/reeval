import { capability, regression } from 'reeval'
import { defineEnvironment, evaluate } from 'reeval/legacy'

const base = defineEnvironment('base', { env: { MODE: 'base' } })
const skilled = base.extendEnvironment('skilled', { env: { MODE: 'skilled' } })

evaluate('best of', { trials: { bestOf: 3 }, target: regression(0.8) }, async () => {})
evaluate('capability reports', { trials: 3, target: capability(0.5) }, async () => {})
evaluate('capability', { trials: 3, target: capability(1, { blocking: true }) }, async () => {})
evaluate(
  'cases regression',
  { cases: [{ key: 'chat' }, { key: 'rag' }], target: regression(0.8) },
  async () => {},
)
evaluate(
  'compare regression',
  { compare: { baseline: base, variants: [skilled] }, target: regression(0.8), trials: 2 },
  async () => {},
)
evaluate(
  'compare reports',
  { compare: { baseline: base, variants: [skilled] }, target: capability(), trials: 4 },
  async () => {},
)
evaluate('reports', { trials: 3 }, async () => {})
