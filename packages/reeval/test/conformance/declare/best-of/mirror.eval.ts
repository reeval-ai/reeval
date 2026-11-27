import { regression } from 'reeval'
import { evaluate, group } from 'reeval/legacy'

evaluate('best of 3', { trials: { bestOf: 3 } }, async () => {})
evaluate('best of 5 over a gate', { trials: { bestOf: 5 }, target: regression() }, async () => {})
group('best of 3 for the group', { trials: { bestOf: 3 } }, () => {
  evaluate('inherits it', async () => {})
  evaluate('a fixed count of its own', { trials: 2 }, async () => {})
})
evaluate('fixed', async () => {})
