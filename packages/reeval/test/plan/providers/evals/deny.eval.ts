import { evaluate } from 'reeval'

evaluate('deny-all on a provider', { egress: 'deny-all' }, async () => {})
