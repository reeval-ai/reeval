import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { boat } from 'reeval/provider/boat'

// Docker tier only: docker() on boat(), the fake Boat API, whose /proc c.serve and the kill tree read.
export default defineConfig({ agents: fakeAgent(), provider: boat() })
