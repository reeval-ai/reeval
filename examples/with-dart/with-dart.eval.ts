import { defineEnvironment, defineEval, expect } from 'reeval'
import { docker } from 'reeval/sandbox'

// The official Dart image: reeval builds it with Node, git and the agent, on this machine's Docker
// or, under the boat or daytona profile, into a saved snapshot on the provider on the first run,
// and later runs start from that snapshot.
const dart = defineEnvironment('dart', { sandbox: docker({ from: 'dart:3.5' }) })

export default defineEval({
  environment: dart,
  task: async (c) => {
    await c.send(
      'Write fizzbuzz.dart with a function fizzbuzz(int n) that returns the FizzBuzz string for ' +
        'n, and fizzbuzz_test.dart, a script that checks 3, 5, 15 and 7 and exits 1 on a ' +
        'mismatch. Core libraries only, no pubspec.',
    )

    await expect(c.exec('dart --version')).toSucceed()
    await expect(c.exec('dart run fizzbuzz_test.dart')).toSucceed()
  },
})
