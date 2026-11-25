import { defineEval } from 'reeval'

export default defineEval({ skip: 'flaky on CI', task: async () => {} })
