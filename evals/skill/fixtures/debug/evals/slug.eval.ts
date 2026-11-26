import { defineEval, regression } from 'reeval'
import { hasFile, judge, succeeded } from 'reeval/graders'

const slugifies = (input: string, slug: string) =>
  `node -e "import('./src/slug.js').then((m) => process.exit(m.slugify('${input}') === '${slug}' ? 0 : 1))"`

export default defineEval({
  target: regression(),
  graders: [
    hasFile('src/slug.js', /export/, { name: 'writes-the-module' }),
    succeeded('slugifies a title'),
    succeeded('trims punctuation'),
    judge('Is slugify short and readable?', { inputs: { contents: ['src/slug.js'] } }),
  ],
  task: async (c) => {
    await c.send(
      'Write src/slug.js exporting slugify(text): lower-case, words joined by single hyphens, ' +
        'no leading or trailing hyphen. Add a package.json with "type": "module".',
    )
    await c.exec(slugifies('Hello World', 'hello-world'), { label: 'slugifies a title' })
    await c.exec(slugifies('  Ahoy, Ada!  ', 'ahoy--ada'), { label: 'trims punctuation' })
  },
})
