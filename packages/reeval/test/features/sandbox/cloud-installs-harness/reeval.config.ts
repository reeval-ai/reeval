import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'

// Docker tier only: cloud() on the fake VM service. The fake agent's bootstrap takes longer than
// its start may, so it starts only when cloud() installed it as the machine started. As the agent: how
// often the bootstrap ran, and whether in its own home.
export default defineConfig({
  harnesses: fakeHarness({
    bootstrap: 'sleep 4; echo "$HOME" >> installs',
    startTimeout: '2s',
    script: [
      [{ exec: 'wc -l < ~/installs; [ "$(cat ~/installs)" = "$HOME" ] && echo own || echo other' }],
    ],
  }),
})
