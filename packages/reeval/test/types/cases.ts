// Compile-time checks of `cases`, run by `pnpm typecheck` (tsconfig.json here): the task's case
// is typed from the list, a task that takes a case needs `cases`, and `caseKey` takes the case's
// type. An unused `@ts-expect-error` fails the build too.
import { defineEnvironment, defineEval } from '../../src/index.ts'

const app = defineEnvironment('app', {})
const skilled = defineEnvironment('skilled', {})

defineEval({
  cases: ['users', 'posts'],
  async task(_c, item) {
    const literal: 'users' | 'posts' = item
    void literal
  },
})
defineEval({
  cases: [{ id: 'a', n: 1 }],
  runs: 2,
  async task(_c, task) {
    const id: string = task.id
    const n: number = task.n
    void [id, n]
  },
})
defineEval({
  cases: [{ slug: 'a' }, { slug: 'b' }],
  caseKey: (t) => t.slug,
  task: async (_c, t) => void t.slug,
})
defineEval({
  cases: [1, 2],
  compare: { control: app, variants: [skilled] },
  task: async () => {},
})
defineEval({ cases: ['a'], skip: true, task: async (_c, item) => void item })
defineEval({ task: async () => {} })

// @ts-expect-error a task taking a case needs cases
defineEval({ task: async (_c, item: string) => void item })
// @ts-expect-error the case is a string, not a number
defineEval({ cases: ['a'], task: async (_c, item: number) => void item })
// @ts-expect-error caseKey returns a string
defineEval({ cases: [{ n: 1 }], caseKey: (t) => t.n, task: async () => {} })
// @ts-expect-error where needs cases
defineEval({ where: () => true, task: async () => {} })
// @ts-expect-error an eval needs its task
defineEval({ cases: ['a'] })
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
