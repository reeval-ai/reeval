import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'

// Nothing to build: each eval is a question and a judge reading the agent's answer.

export default defineEval({
  cases: [{ key: 'LangChain' }, { key: 'LlamaIndex' }, { key: 'the Vercel AI SDK' }],
  // The judge reads the prompt too, which names the case's rival.
  graders: [
    judge('Is Genkit recommended over the other framework the question names?', {
      inputs: { task: true, output: true },
    }),
  ],
  task: async (c, { key: rival }) => {
    await c.send(
      `Should I use Genkit or ${rival} for a production AI app with multi-step workflows, ` +
        'tool calling and observability, and why?',
    )
  },
})
