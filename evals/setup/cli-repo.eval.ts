import { defineEval, defineGraders } from 'reeval'
import { notInDiff } from 'reeval/graders'
import { setUp, shared, sourcesOf, target } from './setup.ts'

/** What the evals it writes should say, by grader name. */
const SAYS: Record<string, RegExp> = {
  'checks-by-running-something': /\.exec\(/,
  'works-in-the-real-repo': /directory\(\s*['"]\.\.['"]/,
  'keeps-env-out-of-the-sandbox': /!\.env/,
  'keeps-the-config-out-of-the-sandbox': /!reeval\.config/,
  'compares-gemini-md': /rules:\s*file\(\s*['"][./]*GEMINI\.md/,
  'leaves-gemini-md-out-of-the-baseline': /!GEMINI\.md/,
}

export default defineEval({
  ...target('firebase-tools'),
  graders: [
    ...shared,
    defineGraders(Object.keys(SAYS), {
      grade: sourcesOf,
      score: Object.fromEntries(
        Object.entries(SAYS).map(([name, re]) => [name, (s: string) => (re.test(s) ? 1 : 0)]),
      ),
    }),
    notInDiff(['src/**', 'README.md', 'GEMINI.md', 'scripts/**']),
  ],
  task: async (c) => {
    await setUp(c, 'Yes, go ahead.')
  },
})
