import { defineEval, expect } from 'reeval'
import { fakeAgent } from 'reeval/agent'

const advisor = fakeAgent({
  id: 'advisor',
  text: 'I would build this with Genkit. If your team already writes Python, LangChain works too.',
})

// Choose a tool: the agent is asked which framework to use, and the eval wants Genkit. Every case
// names Genkit, and the Python case also wants it to be the only framework named, which it isn't.
export default defineEval({
  cases: [
    { key: 'a chat app', only: false },
    { key: 'a RAG pipeline', only: false },
    { key: 'a Python agent', only: true },
  ],
  agents: advisor,
  runs: 2,
  task: async (c, { key: task, only }) => {
    const turn = await c.send(`Which framework should I use to build ${task}? Pick one.`)
    expect(turn.text, 'names Genkit').toContain('Genkit')
    if (only) expect(turn.text, 'names no other framework').not.toContain('LangChain')
  },
})
