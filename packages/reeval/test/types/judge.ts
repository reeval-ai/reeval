// Compile-time checks of `questions`' at-least-one-input rule, run by
// `pnpm typecheck` (`tsc -p test/types`). Each `@ts-expect-error` fails the build if the line
// below it compiles.
import type { EvalOptions, Question } from '../../src/index.ts'

export const questions: Question[] = [
  { question: 'How did the agent find the failing test?', trajectory: true },
  { question: 'Which is cleaner?', across: 'environment', diff: true, task: true },
  { question: 'Which screen is clearer?', across: 'agent', artifacts: ['home'] },
  // @ts-expect-error a question shows at least one input
  { question: 'How did the agent find the failing test?' },
  // @ts-expect-error a bare string shows nothing
  'How did the agent find the failing test?',
  // @ts-expect-error only non-input keys
  { question: 'Which is cleaner?', across: 'environment', model: 'google/gemini-3.8-flash' },
]

export const options: EvalOptions = {
  question: { model: 'google/gemini-3.8-flash' },
  // @ts-expect-error eval-level judge options set no inputs
  judge: { model: 'google/gemini-3.8-flash', diff: true },
}
