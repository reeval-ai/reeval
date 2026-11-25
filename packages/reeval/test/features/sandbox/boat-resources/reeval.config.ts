import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { boat } from 'reeval/provider/boat'

// Docker tier only: docker() on boat(), the fake Boat API, whose sshd containers have a VM's /proc and /sys.
export default defineConfig({ agents: fakeAgent(), provider: boat() })
