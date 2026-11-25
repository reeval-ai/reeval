import { defineEval } from 'reeval'

// Inherits the config's environment too: still one warning, naming the config.
export default defineEval({ task: async () => {} })
