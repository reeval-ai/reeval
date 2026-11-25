// Compile-time checks of `cases`, run by `pnpm typecheck` (tsconfig.json here): every case is an
// object with a `key`, the task's case is typed from the list, and a task that takes a case needs
// `cases`. An unused `@ts-expect-error` fails the build too.
import { type Case, defineEnvironment, defineEval } from '../../src/index.ts'

const app = defineEnvironment('app', {})
const skilled = defineEnvironment('skilled', {})

defineEval({
  cases: [{ key: 'users' }, { key: 'posts' }],
  async task(_c, item) {
    const key: string = item.key
    const literal: 'users' | 'posts' = item.key
    void [key, literal]
  },
})
defineEval({
  cases: [{ key: 'a', n: 1 }],
  runs: 2,
  async task(_c, task) {
    const key: string = task.key
    const n: number = task.n
    void [key, n]
  },
})
defineEval({
  cases: [{ key: 'iso', input: 'PT1H30M' }, { key: 'clock', input: '1:30:00' }],
  where: ({ case: item }) => item.input.length > 0,
  task: async (_c, item) => void item.input,
})
defineEval({
  cases: [{ key: '1' }, { key: '2' }],
  compare: { control: app, variants: [skilled] },
  task: async () => {},
})
defineEval({ cases: [{ key: 'a' }], skip: true, task: async (_c, item) => void item })
defineEval({ task: async () => {} })

const typed: Case<{ input: string }> = { key: 'iso', input: 'PT1H30M' }
const untyped: Case = { key: 'iso' }
void [typed, untyped]
// @ts-expect-error a case needs its key
const keyless: Case<{ input: string }> = { input: 'PT1H30M' }
void keyless

// @ts-expect-error a task taking a case needs cases
defineEval({ task: async (_c, item: Case) => void item })
// @ts-expect-error a case is an object, not a string
defineEval({ cases: ['a'], task: async () => {} })
// @ts-expect-error a case is an object, not a number
defineEval({ cases: [1], task: async () => {} })
// @ts-expect-error every case needs its key
defineEval({ cases: [{ id: 'a' }], task: async () => {} })
// @ts-expect-error a case's key is a string
defineEval({ cases: [{ key: 1 }], task: async () => {} })
// @ts-expect-error the case has no input
defineEval({ cases: [{ key: 'a' }], task: async (_c, item) => void item.input })
// @ts-expect-error caseKey is gone: the key is the case's own
defineEval({ cases: [{ key: 'a' }], caseKey: () => 'b', task: async () => {} })
// @ts-expect-error where needs cases
defineEval({ where: () => true, task: async () => {} })
// @ts-expect-error an eval needs its task
defineEval({ cases: [{ key: 'a' }] })
// @ts-expect-error environment is one key, a list or one
defineEval({ environments: [app], task: async () => {} })
// @ts-expect-error environment beside compare
defineEval({
  environment: app,
  compare: { control: app, variants: [skilled] },
  task: async () => {},
})
// @ts-expect-error harnesses is agents
defineEval({ harnesses: [], task: async () => {} })
// @ts-expect-error skip is true, false or why
defineEval({ skip: 1, task: async () => {} })
