import { defineEval, defineGrader, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

const advisor = fakeAgent({
  id: 'advisor',
  text: 'I would build this with Genkit. If your team already writes Python, LangChain works too.',
})

const answer = (c: { turns: readonly { text: string }[] }) => c.turns.at(-1)?.text ?? ''
const namesGenkit = defineGrader('names-genkit', { grade: (c) => answer(c).includes('Genkit') })
const onlyGenkit = defineGrader('names-no-other-framework', {
  grade: (c) => !(c.case as { only: boolean }).only || !answer(c).includes('LangChain'),
})

// Choose a tool: the agent is asked which framework to use, and the eval wants Genkit. Every case
// names Genkit, and the Python case also wants it to be the only framework named, which it isn't:
// that case scores 50%, and the mean clears the threshold.
export default defineEval({
  cases: [
    { key: 'a chat app', only: false },
    { key: 'a RAG pipeline', only: false },
    { key: 'a Python agent', only: true },
  ],
  agents: advisor,
  runs: 2,
  target: regression(0.8),
  graders: [namesGenkit, onlyGenkit],
  task: async (c, { key: task }) => {
    await c.send(`Which framework should I use to build ${task}? Pick one.`)
  },
})
