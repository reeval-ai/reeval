import { defineEval, expect } from 'reeval'
import { asksFirst, evalList, HARNESS_KEY, INSTALL, names, setUp, target } from './setup.ts'

export default defineEval({
  ...target('empty'),
  task: async (c) => {
    const first = await c.send(`Set up reeval here.${INSTALL}`)
    asksFirst(first, await evalList(c))
    const last = await c.send(
      "I'd like to know whether coding agents set up Tailwind CSS v4 correctly in a new project.",
    )
    await setUp(c, [], { evals: [1, 3] })
    const research = last.transcript.filter(
      (e) =>
        e.type === 'web-search' ||
        e.type === 'web-fetch' ||
        (e.type === 'tool' && /\b(curl|wget|npm (view|info))\b/.test(JSON.stringify(e.input))),
    )
    expect(research.length, 'researches Tailwind v4 first').toBeGreaterThan(0)
    const sources = (await c.exec('cat evals/*.ts 2>/dev/null')).stdout
    expect(sources, 'evals about Tailwind').toMatch(/tailwind/i)
    expect(sources, "checks v4's CSS @import").toMatch(/@import/)
    expect(last.text, 'names the harness key').toMatch(HARNESS_KEY)
  },
})
