import { defineEval, expect } from 'reeval'

// Nothing to build: each eval is a question and a judge reading the agent's answer.

export default defineEval({
  cases: ['LangChain', 'LlamaIndex', 'the Vercel AI SDK'],
  task: async (c, rival) => {
    await c.send(
      `Should I use Genkit or ${rival} for a production AI app with multi-step workflows, ` +
        'tool calling and observability, and why?',
    )

    expect(await c.judge(`Is Genkit recommended over ${rival}?`, { output: true })).toPass()
  },
})
