import { evaluate } from 'reeval/legacy'
import { base, skilled } from '../../../plan/compare/evals/envs.ts'

evaluate(
  'trajectory across harnesses',
  {
    compare: { control: base, variants: [skilled] },
    questions: [
      {
        question: 'Which agent verified its work?',
        across: 'agent',
        trajectory: 'tools',
      },
    ],
  },
  async () => {},
)
evaluate(
  'trajectory within a harness',
  {
    compare: { control: base, variants: [skilled] },
    questions: [
      {
        question: 'Which arm verified its work?',
        across: 'environment',
        trajectory: 'tools',
      },
    ],
  },
  async () => {},
)
evaluate(
  'screenshots',
  {
    compare: { control: base, variants: [skilled] },
    questions: [
      { question: 'Which page looks better?', across: 'environment', artifacts: ['landing'] },
    ],
  },
  async () => {},
)
evaluate(
  'each attempt with the trajectory',
  {
    questions: [
      {
        question: 'What did the agent check before it finished?',
        task: true,
        output: true,
        diff: true,
        trajectory: true,
      },
    ],
  },
  async () => {},
)
evaluate(
  'each attempt without the trajectory',
  {
    questions: [
      { question: 'What did the agent say it did?', task: true, output: true, diff: true },
    ],
  },
  async () => {},
)
