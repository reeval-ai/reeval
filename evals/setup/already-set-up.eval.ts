import { defineEval, expect } from 'reeval'
import { asksFirst, evalList, HARNESS_KEY, INSTALL, names, setUp, target } from './setup.ts'

export default defineEval({
  ...target('firebase-set-up'),
  task: async (c) => {
    const before = names(await evalList(c))
    const greet = await c.readFile('evals/greet.eval.ts')
    const environments = (await c.readFile('evals/environments.ts')) ?? ''
    const first = await c.send(`Set up reeval here.${INSTALL}`)
    asksFirst(
      first,
      names(await evalList(c))
        .filter((f) => !before.includes(f))
        .join('\n'),
    )
    const last = await c.send('Yes, go ahead.')
    const p = await setUp(c, before, { evals: [1, 3] })
    expect(p?.evals.map((e) => e.name) ?? [], 'keeps the existing eval').toContain(
      'creates greet.js',
    )
    expect(await c.readFile('evals/greet.eval.ts'), 'leaves greet.eval.ts as it was').toBe(greet)
    expect(
      (await c.readFile('evals/environments.ts')) ?? '',
      'keeps environments.ts as it was',
    ).toContain(environments.trim())
    expect(c, 'leaves the skills alone').not.toHaveChanged(['skills/**', 'README.md'])
    expect(last.text, 'names the harness key').toMatch(HARNESS_KEY)
  },
})
