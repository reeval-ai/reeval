import { defineEnvironment, defineEval } from 'reeval'

const next = defineEnvironment('next-app', { traits: { stack: 'next', auth: ['clerk', 'none'] } })
const vite = defineEnvironment('vite-app', { traits: { stack: 'vite' } })

// Reading the harness decides each harness on its own: y runs on harness a only.
export default defineEval({
  environment: [next, vite],
  cases: ['x', 'y'],
  where: ({ case: c, harness }) => c === 'x' || harness === 'a',
  task: async () => {},
})
