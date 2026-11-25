import { evaluate, group } from 'reeval/legacy'

group.skip('parked', () => {
  evaluate('inside', async () => {})
  group('nested', () => {
    evaluate('deeper', async () => {})
  })
})
group.todo('someday')
