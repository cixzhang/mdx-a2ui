/**
 * MDX in, A2UI out.
 *
 * Everything is exported under an `experimental_` prefix: the catalog is not
 * settled, the A2UI target is v0.9, and the shape of the pipeline is still
 * being measured. Nothing here is covered by any stability promise.
 */

export {CATALOG as experimental_CATALOG} from './catalog';
export type {
  Catalog,
  CatalogEntry,
  PropType,
  A2uiShape,
} from './catalog';

export {mdxToA2ui as experimental_mdxToA2ui} from './convert';
export type {
  A2uiComponent,
  A2uiMessage,
  ConvertOptions,
  ConvertResult,
} from './convert';

export {repairMdxPrefix as experimental_repairMdxPrefix} from './repair';
export type {RepairKind, RepairResult} from './repair';

import {mdxToA2ui} from './convert';
import type {ConvertOptions, ConvertResult} from './convert';
import {repairMdxPrefix} from './repair';
import type {RepairResult} from './repair';

export type StreamConvertResult = ConvertResult & {
  repair: RepairResult;
  /**
   * False while the document is still arriving. A partially arrived card can
   * show some but not all of its buttons (26% of prefixes, measured), so a
   * surface that accepts answers must not enable controls until this is true.
   */
  settled: boolean;
};

/**
 * Convert a possibly-truncated MDX prefix: heal the syntax, then convert.
 *
 * Both defences are needed and they are separate — without the repair the
 * converter refuses a truncated document, which is correct but renders
 * nothing while the answer is still arriving.
 */
export function experimental_mdxStreamToA2ui(
  prefix: string,
  options: ConvertOptions = {},
): StreamConvertResult {
  const repair = repairMdxPrefix(prefix);
  const converted = mdxToA2ui(repair.text, options);
  return {
    ...converted,
    repair,
    settled: repair.kind === 'clean',
  };
}
