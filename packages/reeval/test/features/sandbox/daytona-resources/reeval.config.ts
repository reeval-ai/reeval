import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { daytona } from 'reeval/provider/daytona'

// Docker tier only: docker() on daytona(), the fake Daytona API, whose sshd containers have a VM's /proc and
// /sys.
export default defineConfig({ agents: fakeAgent(), provider: daytona() })
