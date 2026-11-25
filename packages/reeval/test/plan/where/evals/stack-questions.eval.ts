import { defineEnvironment, defineEval } from 'reeval'

const next = defineEnvironment('next-app', { traits: { stack: 'next', auth: ['clerk', 'none'] } })
const vite = defineEnvironment('vite-app', { traits: { stack: 'vite' } })

const questions = [
  { id: 'q1', stacks: ['next', 'vite'] },
  { id: 'q2', stacks: ['next'] },
  { id: 'q3', stacks: ['vite'] },
]
const fits = ({
  case: q,
  environment,
}: {
  case: (typeof questions)[number]
  environment: { traits: { stack?: unknown } }
}) => q.stacks.includes(environment.traits.stack as string)

// q2 runs on next-app only and q3 on vite-app only, on both harnesses.
export default defineEval({
  environment: [next, vite],
  cases: questions,
  where: fits,
  task: async () => {},
})
