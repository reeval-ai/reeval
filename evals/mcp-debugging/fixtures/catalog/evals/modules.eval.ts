import { defineEval, expect } from 'reeval'
import { MODULES } from '../agent/modules.mjs'

export default defineEval({
  runs: 2,
  cases: MODULES.map((key) => ({ key })),
  task: async (c, { key: name }) => {
    await c.send(`Write src/${name}.js exporting an empty ${name} list, with a doc comment.`)
    expect(await c.readFile(`src/${name}.js`), 'exports the list').toContain('export')
    const verdict = await c.judge(`Is src/${name}.js small, documented and readable?`, {
      contents: [`src/${name}.js`],
    })
    expect(verdict, 'readable').toPass()
  },
})
