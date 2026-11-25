import { defineEval, expect } from 'reeval'
import { asksFirst, evalList, HARNESS_KEY, INSTALL, names, setUp, target } from './setup.ts'

export default defineEval({
  ...target('supabase'),
  task: async (c) => {
    const first = await c.send(`Set up reeval here.${INSTALL}`)
    asksFirst(first, await evalList(c))
    const last = await c.send('Yes, go ahead.')
    const p = await setUp(c, [], { evals: [1, 3] })
    const roles = p?.evals.flatMap((e) => e.cells.map((cell) => cell.role)) ?? []
    expect(roles, 'compares a skill').toContain('variant')
    expect(c, 'leaves the skills and docs alone').not.toHaveChanged([
      'skills/**',
      'README.md',
      'AGENTS.md',
      'test/**',
    ])
    expect(last.text, 'names the harness key').toMatch(HARNESS_KEY)
  },
})
