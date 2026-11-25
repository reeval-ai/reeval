import { defineEval } from 'reeval'

export default defineEval({
  env: { NODE_ENV: 'production', LOG_LEVEL: 'debug' },
  task: async () => {},
})
