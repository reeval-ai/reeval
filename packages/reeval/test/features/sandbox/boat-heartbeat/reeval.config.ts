import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { boat } from 'reeval/provider/boat'

// Docker tier only: docker() on boat(), the fake Boat API, with the run's event stream's heartbeats.
export default defineConfig({ target: regression(), agents: fakeAgent(), provider: boat() })
