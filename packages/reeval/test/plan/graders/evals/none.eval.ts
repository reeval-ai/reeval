import { defineEval } from 'reeval'

// No graders of its own: the config's (and the profile's) still grade it.
export default defineEval({ task: async () => {} })
