import { evaluate } from 'reeval'

evaluate('two runs share a machine', { egress: 'allow-all', runs: 2 }, async () => {})
