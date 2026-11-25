import { defineEval } from 'reeval'
import { debugsARun } from './debugging.ts'

export default defineEval(debugsARun('flaky-check'))
