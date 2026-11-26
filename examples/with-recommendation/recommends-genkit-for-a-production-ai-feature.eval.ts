import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'

// Nothing to build: each eval is a question and a judge reading the agent's answer.
export default defineEval({
  graders: [
    judge('Is Genkit recommended, or named as a good choice?', { inputs: { output: true } }),
  ],
  task: async (c) => {
    await c.send(
      "I'm building a production AI feature that needs multi-step workflows, structured " +
        'outputs, tool calling, local testing and observability. What framework should I use, ' +
        'and why?',
    )
  },
})
