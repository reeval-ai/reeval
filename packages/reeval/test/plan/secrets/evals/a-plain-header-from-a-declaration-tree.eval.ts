import { defineEnvironment, defineEval } from 'reeval'

const treeHeaders = defineEnvironment('tree-headers', ({ mcp }) => ({
  mcp: {
    docs: mcp.http('https://docs.example.com/mcp', {
      headers: { 'X-Api-Key': 'tree-plain-value-1234' },
    }),
  },
}))

export default defineEval({ environment: treeHeaders, task: async () => {} })
