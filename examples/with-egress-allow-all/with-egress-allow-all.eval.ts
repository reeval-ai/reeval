import { defineEval } from 'reeval'
import { observed, succeeded } from 'reeval/graders'

// SSH is raw TCP, which the gateway can't carry: under every other policy the container has no
// network of its own. allow-all keeps it, unfiltered and unrecorded, so set it on this eval only.
export default defineEval({
  egress: 'allow-all',
  graders: [
    succeeded('bash banner.sh'),
    observed('banner', (line) => /^SSH-2\.0-/.test(String(line))),
  ],
  task: async (c) => {
    await c.send(
      "Write banner.sh, a bash script that prints the first line github.com's SSH server sends on " +
        'port 22, using /dev/tcp.',
    )

    c.observe('banner', (await c.exec('bash banner.sh')).stdout)
  },
})
