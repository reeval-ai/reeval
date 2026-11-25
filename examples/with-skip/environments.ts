import { defineEnvironment } from 'reeval'

// checks/call.mjs goes in the sandbox's home, outside the workspace and its diff.
export const math = defineEnvironment('math', ({ directory, file }) => ({
  files: { ...directory('./project'), '~/checks/call.mjs': file('./checks/call.mjs') },
}))
