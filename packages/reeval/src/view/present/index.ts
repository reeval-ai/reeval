// `reeval/view/present`: the presentation every surface renders, its Zod schema, the one adapter
// from a `RunReport` (`present`), and the section order and texts the renderers share.

export { EFFECT_TEXT, present } from './from-run-report.ts'
export { HARNESS_NAMES, harnessName } from './harness.ts'
export * from './schema.ts'
export {
  type Detail,
  metricText,
  type Section,
  type SectionKind,
  sectionsOf,
  sectionTexts,
} from './sections.ts'
