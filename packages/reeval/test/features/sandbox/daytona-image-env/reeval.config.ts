import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'
import { daytona } from 'reeval/provider/daytona'

// Docker tier only: a Dockerfile on daytona(), the fake Daytona API, whose sandboxes run every
// command over SSH, which applies no image `ENV`. The Dockerfile puts a tool on PATH and sets a
// variable. As the agent: where the tool is, in its shell and a login shell, and the variable.
export default defineConfig({
  harnesses: fakeHarness({
    script: [
      [
        {
          exec: "command -v reeval-fixture-tool; bash -lc 'command -v reeval-fixture-tool'; printenv REEVAL_FIXTURE_IMAGE_ENV",
        },
      ],
    ],
  }),
  provider: daytona(),
})
