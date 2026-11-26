import { defineConfig, regression } from 'reeval'
import { codex } from 'reeval/agent'

// Real Codex only (C), with OPENAI_API_KEY: the agent searches the web with its web search tool,
// which Codex runs itself on POST api.openai.com/v1/alpha/search with the brokered key.
export default defineConfig({
  target: regression(),
  agents: codex({ model: process.env.REEVAL_REAL_MODEL ?? 'gpt-5.6-luna' }),
})
