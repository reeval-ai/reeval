import { capability, metric, regression } from 'reeval'
import { defineEnvironment, evaluate } from 'reeval/legacy'

const base = defineEnvironment('base', { env: { MODE: 'base' } })
const skilled = base.extendEnvironment('skilled', { env: { MODE: 'skilled' } })

evaluate('best of', { runs: { bestOf: 3 }, target: regression(0.8) }, async () => {})
evaluate('capability reports', { runs: 3, target: capability(0.5) }, async () => {})
evaluate('capability', { runs: 3, target: capability(1, { blocking: true }) }, async () => {})
evaluate(
  'cases metric',
  { cases: [{ key: 'chat' }, { key: 'rag' }], target: metric(0.8) },
  async () => {},
)
evaluate(
  'compare regression',
  { compare: { control: base, variants: [skilled] }, target: regression(0.8), runs: 2 },
  async () => {},
)
evaluate(
  'compare reports',
  { compare: { control: base, variants: [skilled] }, target: metric(), runs: 4 },
  async () => {},
)
evaluate('reports', { runs: 3 }, async () => {})
