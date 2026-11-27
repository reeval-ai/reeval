import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { createDaytona } from 'reeval/provider/daytona'

// Docker tier only: daytona({ reuse: true }) on the fake Daytona API, one machine at a time. As the
// agent: whether the trial before left a file in its home or /tmp, or a process running, then
// leave all three for the next.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    script: [
      [
        {
          exec: [
            'test -e ~/left-behind && echo home-dirty || echo home-clean',
            'test -e /tmp/left-behind-$(id -un) && echo tmp-dirty || echo tmp-clean',
            'pgrep -u "$(id -un)" -x -f "sleep 4242" >/dev/null && echo proc-dirty || echo proc-clean',
            'touch ~/left-behind /tmp/left-behind-$(id -un)',
            'n=4242; (setsid sleep $n >/dev/null 2>&1 &)',
          ].join('; '),
        },
      ],
    ],
  }),
  provider: createDaytona({ prefix: 'pool' })({ reuse: true, maxConcurrent: 1 }),
})
