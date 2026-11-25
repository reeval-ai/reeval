import { defineEnvironment, defineEval } from 'reeval'

const fetcher = defineEnvironment('fetcher', ({ plugin }) => ({
  plugins: [plugin.local('../plugins/fetcher')],
}))

export default defineEval({ environment: fetcher, task: async () => {} })
