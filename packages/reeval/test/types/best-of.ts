// Compile-time checks of `runs: { bestOf }`, run by `pnpm typecheck` (tsconfig.json here): an
// inline literal that isn't odd and 3 or more is a type error, and a value typed `number` is not,
// so the run-time check refuses it instead. An unused `@ts-expect-error` fails the build too.
import { defineEval } from '../../src/index.ts'

const task = async () => {}

defineEval({ runs: { bestOf: 3 }, task })
defineEval({ runs: { bestOf: 5 }, task })
defineEval({ runs: { bestOf: 21 }, task })
defineEval({ runs: 4, task })
defineEval({ runs: { bestOf: 3 }, skip: true, task })
defineEval({ runs: { bestOf: 9 }, skip: 'flaky on CI', task })

// @ts-expect-error even
defineEval({ runs: { bestOf: 4 }, task })
// @ts-expect-error below 3
defineEval({ runs: { bestOf: 1 }, task })
// @ts-expect-error not whole
defineEval({ runs: { bestOf: 3.5 }, task })
// @ts-expect-error negative
defineEval({ runs: { bestOf: -3 }, task })
// @ts-expect-error even, skipped
defineEval({ runs: { bestOf: 2 }, skip: true, task })
// @ts-expect-error an unknown key
defineEval({ runs: { bestOf: 3, min: 2 }, task })

declare const n: number
defineEval({ runs: { bestOf: n }, task })
const fromConfig = { bestOf: n }
defineEval({ runs: fromConfig, task })
