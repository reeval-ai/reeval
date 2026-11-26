import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// tart() on the fake `tart`. The fake agent's bootstrap writes the home it ran in, which preflight
// bakes into an image of its own; the agent says whether that's its own home, and which VM it was.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    bootstrap: 'echo "$HOME" > installed-in',
    script: [
      [
        {
          exec: 'in=$(cat ~/installed-in); [ "$in" = "$HOME" ] && echo here || echo baked; basename "$(dirname "$in")"',
        },
      ],
    ],
  }),
})
