import { regression } from 'reeval'
import { evaluate, group } from 'reeval/legacy'

evaluate('best of 3', { runs: { bestOf: 3 } }, async () => {})
evaluate('best of 5 over a gate', { runs: { bestOf: 5 }, target: regression() }, async () => {})
group('best of 3 for the group', { runs: { bestOf: 3 } }, () => {
  evaluate('inherits it', async () => {})
  evaluate('a fixed count of its own', { runs: 2 }, async () => {})
})
evaluate('fixed', async () => {})
