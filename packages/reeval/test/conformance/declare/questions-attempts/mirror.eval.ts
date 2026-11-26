import { regression } from 'reeval'
import { evaluate } from 'reeval/legacy'
import { base, skilled } from '../../../plan/compare/evals/envs.ts'

// Without across, a question is asked of each attempt on its own, with or without a compare.
evaluate(
  'asked of each attempt',
  { questions: [{ question: 'How did the agent find the failing test?', trajectory: true }] },
  async () => {},
)
evaluate(
  'with choices',
  {
    runs: 2,
    target: regression(0.5),
    questions: [
      {
        question: 'Did the agent run the tests first?',
        choices: ['yes', 'no'],
        trajectory: 'tools',
      },
    ],
  },
  async () => {},
)
evaluate(
  'beside a compare',
  {
    compare: { control: base, variants: [skilled] },
    questions: [
      { question: 'What did the agent read first?', trajectory: 'tools' },
      { question: 'Which is cleaner?', across: 'environment', diff: true },
    ],
  },
  async () => {},
)
evaluate(
  'across harnesses without a compare',
  {
    questions: [
      { question: 'Which agent explained its change better?', across: 'agent', diff: true },
    ],
  },
  async () => {},
)
