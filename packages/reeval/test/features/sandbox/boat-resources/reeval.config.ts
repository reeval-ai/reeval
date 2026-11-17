import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'
import { boat } from 'reeval/provider/boat'

// Docker tier only: docker() on boat(), the fake Boat API, whose sshd containers have a VM's /proc and /sys.
export default defineConfig({ harnesses: fakeHarness(), provider: boat() })
