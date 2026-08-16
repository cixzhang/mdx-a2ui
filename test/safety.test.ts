/**
 * The ten probes that broke the runtime-MDX prototype, run against the
 * converter. Each is a document a model could plausibly emit — by accident,
 * or via prompt injection through tool output it read.
 *
 * The point is not that they are sandboxed. There is no evaluator in the
 * path, so a side effect has nowhere to happen: every probe must be refused
 * (or, for raw HTML, carried inertly as markdown text) and the global tripwire
 * must stay empty.
 */

import {beforeEach, describe, expect, test} from 'vitest';

import {experimental_mdxToA2ui as mdxToA2ui} from '../src';

declare global {
  var __SIDE_EFFECTS__: string[];
  var __leak: ((what: string) => string) | undefined;
}

beforeEach(() => {
  globalThis.__SIDE_EFFECTS__ = [];
  globalThis.__leak = (what: string) => {
    globalThis.__SIDE_EFFECTS__.push(what);
    return '';
  };
});

const refused: Array<[string, string]> = [
  ['unknown component', 'Here you go.\n\n<Fancy title="x" />\n'],
  [
    'expression executes',
    "Total: {globalThis.__leak('expression-ran') || 'ok'}\n",
  ],
  [
    'expression reads globals',
    "{typeof process === 'undefined' ? 'no process' : 'HAS process: ' + Object.keys(process.env).length}\n",
  ],
  ['export statement', 'export const meta = {secret: 1}\n\nHello\n'],
  ['import statement', "import fs from 'node:fs'\n\nHello\n"],
  [
    'component identity override',
    'export const Ask = () => null\n\n<Ask question="q" id="1" />\n',
  ],
  [
    'hot loop in expression',
    '{(() => {let n = 0; for (let i = 0; i < 5e7; i++) n += i; return n;})()}\n',
  ],
  [
    'prop is an expression',
    "<Field label=\"x\" value={globalThis.__leak('prop-expression') || 'v'} />\n",
  ],
  ['unknown prop', '<Choice value="a" label="A" onClick="go" />\n'],
  ['wrong prop type', '<CodeRef path="a.ts" line="12" />\n'],
];

describe('safety probes', () => {
  test.each(refused)('%s is refused', (_name, source) => {
    const {errors} = mdxToA2ui(source);
    expect(errors.length).toBeGreaterThan(0);
    expect(globalThis.__SIDE_EFFECTS__).toEqual([]);
  });

  test('a hot loop is refused in well under the time it would take to run', () => {
    const start = Date.now();
    const {errors} = mdxToA2ui(
      '{(() => {let n = 0; for (let i = 0; i < 5e7; i++) n += i; return n;})()}\n',
    );
    expect(errors[0]).toContain('data, not code');
    expect(Date.now() - start).toBeLessThan(1000);
  });

  test('raw HTML is refused too — the catalog is the only vocabulary', () => {
    const source = '<img src="x" onerror="__leak(\'img-onerror\')" />\n';
    const {errors} = mdxToA2ui(source);
    expect(errors[0]).toContain('unknown component <img>');
    expect(globalThis.__SIDE_EFFECTS__).toEqual([]);
  });

  test('a refusal says what is allowed instead', () => {
    const {errors} = mdxToA2ui('<Fancy />\n');
    expect(errors[0]).toContain('allowed:');
  });
});
