import { defineEval } from 'reeval'

export default defineEval({
  capture: {
    viewport: { width: 1280, height: 720 },
    timeout: '30s',
  },
  task: async () => {},
})
