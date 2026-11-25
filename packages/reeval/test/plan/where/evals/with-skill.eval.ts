import { defineEnvironment, defineEval } from 'reeval'

const next = defineEnvironment('next-app', { traits: { stack: 'next', auth: ['clerk', 'none'] } })
const vite = defineEnvironment('vite-app', { traits: { stack: 'vite' } })
const skilled = next.extend('next-skilled', { env: { SKILL: '1' } })

const questions = [
  { key: 'q1', stacks: ['next', 'vite'] },
  { key: 'q2', stacks: ['next'] },
  { key: 'q3', stacks: ['vite'] },
]
const fits = ({
  case: q,
  environment,
}: {
  case: (typeof questions)[number]
  environment: { traits: { stack?: unknown } }
}) => q.stacks.includes(environment.traits.stack as string)

// The control's answer holds for its variant: q3 runs on neither arm.
export default defineEval({
  compare: { control: next, variants: [skilled] },
  cases: questions,
  where: fits,
  task: async () => {},
})
