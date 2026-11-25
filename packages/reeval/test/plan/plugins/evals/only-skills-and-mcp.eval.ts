import { defineEnvironment, defineEval } from 'reeval'

const review = defineEnvironment('review', ({ plugin }) => ({
  plugins: [plugin.local('../plugins/review')],
}))
const narrowed = defineEnvironment('narrowed', ({ plugin }) => ({
  plugins: [plugin.local('../plugins/review', { only: ['skills', 'mcp'] })],
}))
const lite = review.extend('lite', ({ plugin }) => ({
  plugins: [plugin.local('../plugins/review-lite')],
}))

export default defineEval({ environment: narrowed, task: async () => {} })
