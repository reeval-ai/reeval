import { defineEnvironment, defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'
import { docker } from 'reeval/sandbox'

// The official Python image: reeval bakes Node, git and the agent onto it on the first run.
const python = defineEnvironment('python', {
  sandbox: docker({ from: 'python:3.12-slim', id: 'python' }),
})

export default defineEval({
  environment: python,
  graders: [succeeded('python3 --version'), succeeded('python3 -m unittest -q')],
  task: async (c) => {
    await c.send(
      'Write fizzbuzz.py with a function fizzbuzz(n) that returns the FizzBuzz string for n, and ' +
        'test_fizzbuzz.py with unittest tests for 3, 5, 15 and 7. Standard library only.',
    )

    await c.exec('python3 --version')
    await c.exec('python3 -m unittest -q')
  },
})
