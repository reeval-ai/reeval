import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

const target = `http://${process.env.REEVAL_EGRESS_TARGET}/`

// Docker tier only: cloud() with an image recipe on the fake VM service, whose VMs prepare the
// image in their Docker, the host's. As the agent: what the recipe baked, who runs the
// shell, and the host's listener reached directly, around the proxy, then through it.
export default defineConfig({
  agents: fakeAgent({
    script: [
      [
        {
          exec: `cat /etc/reeval-recipe; id -un; curl -s -m 5 -o /dev/null -w '%{http_code}' --noproxy '*' ${target}; echo " exit=$?"; curl -s -m 10 -o /dev/null -w '%{http_code}' ${target}; echo`,
        },
      ],
    ],
  }),
})
