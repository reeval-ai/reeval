import { defineEval, defineGrader } from 'reeval'
import { judge } from 'reeval/graders'
import { MODULES } from '../agent/modules.mjs'

const exportsTheList = defineGrader('exports-the-list', {
  files: ['src/*.js'],
  grade: async (c) => (await c.readFile(`src/${c.case.key}.js`)).includes('export'),
})

export default defineEval({
  runs: 2,
  cases: MODULES.map((key) => ({ key })),
  graders: [
    exportsTheList,
    judge('Is the new module small, documented and readable?', { inputs: { diff: true } }),
  ],
  task: async (c, { key: name }) => {
    await c.send(`Write src/${name}.js exporting an empty ${name} list, with a doc comment.`)
  },
})
