import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'
import { daytona } from 'reeval/provider/daytona'

// Docker tier only: docker() on daytona(), the fake Daytona API, whose sshd containers have a VM's /proc and
// /sys.
export default defineConfig({ harnesses: fakeHarness(), provider: daytona() })
