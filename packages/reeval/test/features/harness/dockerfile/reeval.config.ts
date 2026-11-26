import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { layout } from './layout.ts'

// Docker only: the image is the feature. The fake agent takes REEVAL_FIXTURE_LAYOUT's layout and
// image, so REEVAL_BASE is that harness's image and no key is needed.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ layout }),
})
