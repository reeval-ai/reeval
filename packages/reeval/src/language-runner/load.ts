import { declareDefault } from '../evaluate.ts'
import { adapterForFile } from './adapter.ts'

/**
 * Loads an eval file through its language adapter while the worker is collecting: a TypeScript
 * file's eval is its default export.
 */
export async function loadEvalModule(file: string, root: string): Promise<unknown> {
  const adapter = adapterForFile(file)
  const loaded = await adapter.load(file, root)
  if (!adapter.remote) declareDefault(file, loaded)
  return loaded
}
