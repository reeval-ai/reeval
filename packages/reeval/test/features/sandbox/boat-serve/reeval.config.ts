import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'
import { boat } from 'reeval/provider/boat'

// Docker tier only: docker() on boat(), the fake Boat API, whose /proc c.serve and the kill tree read.
export default defineConfig({ harnesses: fakeHarness(), provider: boat() })
