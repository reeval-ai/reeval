import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// Its log line and pass reach the event stream, and reeval attach prints them as the run did.
export default defineEval({
  graders: [observed('trial', (n) => n === 1)],
  task: async (c) => {
    console.log('streamed from lands')
    c.observe('trial', c.trial.n)
  },
})
