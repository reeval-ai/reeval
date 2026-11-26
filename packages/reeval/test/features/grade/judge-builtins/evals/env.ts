import { defineEnvironment } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'

export const plain = defineEnvironment('plain', {
  sandbox: fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) }),
})
