import { evaluate } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'

evaluate('on the fake sandbox', { sandbox: fakeSandbox(), egress: 'allow-all' }, async () => {})
