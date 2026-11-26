// biome-ignore lint/suspicious/noShadowRestrictedNames: reeval's EvalError stands in for the global one
import { defineEnvironment, defineEval, EvalError } from 'reeval'
import { hasFile, judge } from 'reeval/graders'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  graders: [
    hasFile('src/math.js', /export function average/),
    // Each model answers with its provider's own key; the grade is both answers and the score
    // their mean. Set on the grader, they win over any profile's judge.
    judge('Would a new reader follow average, with the empty list handled on purpose?', {
      inputs: { diff: true },
      models: ['anthropic/claude-sonnet-5', 'google/gemini-3.8-flash'],
    }),
  ],
  task: async (c) => {
    await c.send('Add an average(xs) function to src/math.js. It returns 0 for an empty list.')

    // Failing tests end the attempt at 0, before either judge costs anything.
    const tests = await c.exec('node --test')
    if (tests.exitCode !== 0) throw new EvalError('the tests fail')
  },
})
