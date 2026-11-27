import { defineEnvironment, defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

// The page in ./project is the baseline; the variant adds Anthropic's published brand-guidelines
// skill, fetched from its repository at a pinned commit.
const page = defineEnvironment('page', ({ directory }) => ({ files: directory('./project') }))
const withSkill = page.extendEnvironment('brand-guidelines', ({ skill }) => ({
  skills: [
    skill.git('github:anthropics/skills', {
      ref: 'dbd4588f9e1033efb41dad4bef2f7947c8993d44',
      path: 'skills',
      only: ['brand-guidelines'],
    }),
  ],
}))

export default defineEval({
  compare: { baseline: page, variants: [withSkill] },
  trials: 4,
  graders: [
    hasFile('index.html', /href="styles\.css"/),
    hasFile('styles.css', /#d97757/i, { name: 'brand-orange' }),
    hasFile('styles.css', /Poppins[\s\S]*Lora|Lora[\s\S]*Poppins/, { name: 'brand-fonts' }),
  ],
  task: async (c) => {
    await c.send(
      "Give index.html Anthropic's look: write styles.css with Anthropic's brand colors and " +
        'fonts, and link it from index.html.',
    )
  },
})
