import { defineEval } from 'reeval'
import { contributes } from './contributing.ts'

export default defineEval(contributes('question-model'))
