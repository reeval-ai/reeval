import { DEFAULT_EGRESS_ALLOW, defineEval, expect } from 'reeval'

// The package registries and GitHub, plus one site. The harness's API is allowed on top.
const egress = { allow: [...DEFAULT_EGRESS_ALLOW, 'example.com'] }

export default defineEval({
  egress,
  task: async (c) => {
    await c.send(
      'Write title.js, a Node script that fetches https://example.com and prints its title.',
    )

    const run = await c.exec('node title.js')
    expect(run).toSucceed()
    expect(run.stdout.trim()).toBe('Example Domain')
    expect((await c.exec('curl -sS https://example.org')).exitCode, 'other hosts').not.toBe(0)
  },
})
