import { defineEval, expect } from 'reeval'
import { asksFirst, evalList, HARNESS_KEY, INSTALL, names, setUp, target } from './setup.ts'

export default defineEval({
  ...target('firebase-tools'),
  task: async (c) => {
    const first = await c.send(`Set up reeval here.${INSTALL}`)
    asksFirst(first, await evalList(c))
    const last = await c.send('Yes, go ahead.')
    await setUp(c, [], { evals: [1, 3] })
    const sources = (await c.exec('cat evals/*.ts 2>/dev/null')).stdout
    expect(sources, 'checks by running something').toMatch(/\.exec\(/)
    expect(sources, 'works in the real repo').toMatch(/directory\(\s*['"]\.\.['"]/)
    expect(sources, 'keeps .env out of the sandbox').toMatch(/!\.env/)
    expect(sources, 'keeps the config out of the sandbox').toMatch(/!reeval\.config/)
    expect(sources, 'compares GEMINI.md').toMatch(/rules:\s*file\(\s*['"][./]*GEMINI\.md/)
    expect(sources, 'leaves GEMINI.md out of the control').toMatch(/!GEMINI\.md/)
    expect(c, 'leaves the code and docs alone').not.toHaveChanged([
      'src/**',
      'README.md',
      'GEMINI.md',
      'scripts/**',
    ])
    expect(last.text, 'names the harness key').toMatch(HARNESS_KEY)
  },
})
