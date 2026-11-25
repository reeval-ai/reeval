import { defineEnvironment, defineEval } from 'reeval'

const plain = defineEnvironment('plain', {})
const skilled = defineEnvironment('skilled', { env: { MODE: 'x' } })

export default defineEval({
  compare: { control: plain, variants: [skilled] },
  task: async () => {},
})
