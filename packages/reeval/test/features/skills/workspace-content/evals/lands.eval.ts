import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting, staged } from './env.ts'

// The staged SKILL.md has reeval's frontmatter (name, then the description folded to one line) and
// the body byte for byte.
export default defineEval({
  environment: greeting,
  graders: [
    observed<string>(
      'SKILL.md',
      (text) =>
        text ===
        [
          '---',
          'name: house-greeting',
          `description: "The organization's greeting style. Use when writing greetings."`,
          '---',
          '',
          '# House greeting',
          '',
          'Greet people with "Ahoy, <name>!".',
          '',
        ].join('\n'),
    ),
  ],
  task: async (c) => {
    c.observe('SKILL.md', await c.readFile(staged))
  },
})
