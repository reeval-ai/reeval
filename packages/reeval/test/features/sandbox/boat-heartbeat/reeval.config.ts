import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'
import { boat } from 'reeval/provider/boat'

// Docker tier only: docker() on boat(), the fake Boat API, with the run's event stream's heartbeats.
export default defineConfig({ harnesses: fakeHarness(), provider: boat() })
