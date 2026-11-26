import { DEFAULT_EGRESS_ALLOW, defineEval } from 'reeval'
import { observed, succeeded } from 'reeval/graders'

// The package registries and GitHub, plus one site. The harness's API is allowed on top.
const egress = { allow: [...DEFAULT_EGRESS_ALLOW, 'example.com'] }

export default defineEval({
  egress,
  graders: [
    succeeded('node title.js'),
    observed('title', (title) => title === 'Example Domain'),
    observed('other-hosts-blocked'),
  ],
  task: async (c) => {
    await c.send(
      'Write title.js, a Node script that fetches https://example.com and prints its title.',
    )

    c.observe('title', (await c.exec('node title.js')).stdout.trim())
    const other = await c.exec('curl -sS https://example.org')
    c.observe('other-hosts-blocked', other.exitCode !== 0)
  },
})
