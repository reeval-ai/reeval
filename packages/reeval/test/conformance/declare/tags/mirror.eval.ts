import { evaluate, group } from 'reeval/legacy'

group('slow things', { tags: ['slow'] }, () => {
  evaluate('big', async () => {})
  evaluate('bigger', { tags: ['flaky'] }, async () => {})
})
evaluate('quick', async () => {})
evaluate('case', { cases: [{ key: '1' }, { key: '2' }], tags: ['slow'] }, async () => {})
