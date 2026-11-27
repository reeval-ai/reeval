// Compile-time checks of `trials: { bestOf }`, run by `pnpm typecheck` (tsconfig.json here): an
// inline literal that isn't odd and 3 or more is a type error, and a value typed `number` is not,
// so the run-time check refuses it instead. An unused `@ts-expect-error` fails the build too.
import { defineEval } from '../../src/index.ts'

const task = async () => {}

defineEval({ trials: { bestOf: 3 }, task })
defineEval({ trials: { bestOf: 5 }, task })
defineEval({ trials: { bestOf: 21 }, task })
defineEval({ trials: 4, task })
defineEval({ trials: { bestOf: 3 }, skip: true, task })
defineEval({ trials: { bestOf: 9 }, skip: 'flaky on CI', task })

// @ts-expect-error even
defineEval({ trials: { bestOf: 4 }, task })
// @ts-expect-error below 3
defineEval({ trials: { bestOf: 1 }, task })
// @ts-expect-error not whole
defineEval({ trials: { bestOf: 3.5 }, task })
// @ts-expect-error negative
defineEval({ trials: { bestOf: -3 }, task })
// @ts-expect-error even, skipped
defineEval({ trials: { bestOf: 2 }, skip: true, task })
// @ts-expect-error an unknown key
defineEval({ trials: { bestOf: 3, min: 2 }, task })

declare const n: number
defineEval({ trials: { bestOf: n }, task })
const fromConfig = { bestOf: n }
defineEval({ trials: fromConfig, task })
