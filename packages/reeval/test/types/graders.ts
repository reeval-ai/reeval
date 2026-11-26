// Compile-time checks of `graders`, run by `pnpm typecheck` (tsconfig.json here): a grader's case
// type has to fit the eval's cases, its grade is typed from `grade`, and `score` takes that grade.
// An unused `@ts-expect-error` fails the build too.
import {
  defineEval,
  defineGrader,
  defineGraders,
  type GraderContext,
  type JSONValue,
} from '../../src/index.ts'

const anyCase = defineGrader('any-case', { grade: (c) => c.case.key.length > 0 })
const needsInput = defineGrader<{ input: string }>('needs-input', {
  grade: (c) => c.case.input.length,
  score: (n) => (n > 0 ? 1 : 0),
})
const annotated = defineGrader('annotated', {
  grade: (c: GraderContext<{ input: string }>) => c.case.input,
})
const counted = defineGrader('counted', {
  grade: async (c) => (await c.readFile('out.txt')).length,
  score: (n) => Math.min(n / 10, 1),
  weight: 2,
  required: true,
  files: ['out.txt'],
})
const [builds, tests] = defineGraders(['builds', 'tests'], {
  grade: () => ({ built: true, passed: 3 }),
  score: { builds: (g) => (g.built ? 1 : 0), tests: (g) => g.passed / 3 },
  weight: { tests: 2 },
})

defineEval({
  cases: [{ key: 'a', input: 'x' }],
  graders: [anyCase, needsInput, annotated, counted, [builds, tests]],
  task: async () => {},
})
defineEval({ graders: [anyCase, counted], task: async () => {} })

defineEval({
  cases: [{ key: 'a', other: 1 }],
  // @ts-expect-error the grader reads case.input, which these cases don't have
  graders: [needsInput],
  task: async () => {},
})
// @ts-expect-error an eval without cases has no case.input to read
defineEval({ graders: [needsInput], task: async () => {} })

defineGrader('typed-grade', {
  grade: () => 3,
  // @ts-expect-error the grade is a number, which has no length
  score: (g) => g.length,
})
defineGrader('not-json', {
  // @ts-expect-error a grade is JSON
  grade: () => new Map<string, JSONValue>(),
})
defineGraders(['a', 'b'], {
  grade: () => 1,
  // @ts-expect-error every member needs its score
  score: { a: () => 1 },
})

const [lengthOf, emptyOf] = defineGraders<{ input: string }>()(['length', 'empty'], {
  grade: (c) => c.case.input.length,
  score: { length: (n) => Math.min(n / 10, 1), empty: (n) => (n === 0 ? 0 : 1) },
})
const [fromAnnotation] = defineGraders(['from-annotation'], {
  grade: (c: GraderContext<{ input: string }>) => c.case.input,
  score: { 'from-annotation': (s) => s.length },
})
defineEval({
  cases: [{ key: 'a', input: 'x' }],
  graders: [[lengthOf, emptyOf], fromAnnotation],
  task: async () => {},
})
defineEval({
  cases: [{ key: 'a', other: 1 }],
  // @ts-expect-error these graders read case.input, which these cases don't have
  graders: [[lengthOf, emptyOf]],
  task: async () => {},
})
defineGraders<{ input: string }>()(['a', 'b'], {
  grade: (c) => c.case.input,
  // @ts-expect-error every member needs its score, with the case type given too
  score: { a: () => 1 },
})
defineGraders<{ input: string }>()(['a'], {
  grade: () => 1,
  // @ts-expect-error a score names only the group's members
  score: { a: () => 1, c: () => 1 },
})
// @ts-expect-error the case type goes on defineGraders<C>(), not beside the names
defineGraders<{ input: string }>(['a'], { grade: () => 1, score: { a: () => 1 } })
