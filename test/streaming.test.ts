/**
 * Streaming: the repair pass is what makes a truncated prefix convertible,
 * and the converter is what makes the result paintable (root first).
 *
 * The numbers asserted here are the measurement from the prototype, re-run
 * over every prefix of the twelve model-authored documents.
 */

import {describe, expect, test} from 'vitest';

import llmdocs from '../fixtures/llmdocs.json';
import type {A2uiComponent} from '../src';
import {
  experimental_mdxStreamToA2ui as mdxStreamToA2ui,
  experimental_mdxToA2ui as mdxToA2ui,
  experimental_repairMdxPrefix as repairMdxPrefix,
} from '../src';

const docs = Object.values(llmdocs as Record<string, string>);

function prefixes(source: string, step: number): string[] {
  const out: string[] = [];
  for (let i = step; i < source.length; i += step) out.push(source.slice(0, i));
  out.push(source);
  return out;
}

function rate(convert: (prefix: string) => {errors: string[]}): number {
  let total = 0;
  let clean = 0;
  for (const doc of docs) {
    for (const prefix of prefixes(doc, 8)) {
      total += 1;
      if (convert(prefix).errors.length === 0) clean += 1;
    }
  }
  return clean / total;
}

describe('repair', () => {
  test('a clean prefix is left alone', () => {
    const source = 'Hello.\n\n<Choice value="a" label="A" />\n';
    const repaired = repairMdxPrefix(source);
    expect(repaired).toMatchObject({kind: 'clean', dropped: 0, closed: []});
    expect(repaired.text).toBe(source);
  });

  test('a half-written tag name is cut back to a boundary', () => {
    expect(repairMdxPrefix('Hello.\n\n<Choi')).toMatchObject({
      kind: 'in-tag-name',
      text: 'Hello.\n\n',
    });
  });

  test('an open quote is closed and the partial value kept', () => {
    const repaired = repairMdxPrefix('<Choice value="a" label="Sh');
    expect(repaired.kind).toBe('in-attr-value');
    expect(repaired.text).toBe('<Choice value="a" label="Sh" />');
  });

  test('a half-written expression drops that attribute only', () => {
    const repaired = repairMdxPrefix('<Table columns={["a","b"]} rows={[["1');
    expect(repaired.kind).toBe('in-expression');
    expect(repaired.text).toBe('<Table columns={["a","b"]} />');
  });

  test('unclosed elements are closed innermost first', () => {
    const repaired = repairMdxPrefix('<Card title="t">\n<Ask question="q">\n');
    expect(repaired.closed).toEqual(['Ask', 'Card']);
    expect(repaired.text.endsWith('</Ask></Card>')).toBe(true);
  });

  test('the repair only ever appends or cuts back — never rewrites', () => {
    for (const doc of docs) {
      for (const prefix of prefixes(doc, 64)) {
        const {text, dropped} = repairMdxPrefix(prefix);
        expect(text.startsWith(prefix.slice(0, prefix.length - dropped))).toBe(
          true,
        );
      }
    }
  });
});

describe('streaming, over every prefix of the model-authored corpus', () => {
  test('raw prefixes mostly do not convert', () => {
    expect(rate((prefix) => mdxToA2ui(prefix))).toBeLessThan(0.5);
  });

  test('repaired prefixes almost always convert', () => {
    expect(rate((prefix) => mdxStreamToA2ui(prefix))).toBeGreaterThan(0.95);
  });

  test('root is first at every point in the stream', () => {
    for (const doc of docs) {
      for (const prefix of prefixes(doc, 32)) {
        const {messages} = mdxStreamToA2ui(prefix);
        const update = messages[1] as {
          updateComponents: {components: A2uiComponent[]};
        };
        expect(update.updateComponents.components[0].id).toBe('root');
      }
    }
  });

  test('prose paints from the first prefix, before any component arrives', () => {
    const {errors, messages} = mdxStreamToA2ui(docs[0].slice(0, 40));
    expect(errors).toEqual([]);
    const update = messages[1] as {
      updateComponents: {components: A2uiComponent[]};
    };
    expect(
      update.updateComponents.components.some(
        (c) => c.component === 'MarkdownText',
      ),
    ).toBe(true);
  });

  test('an unsettled prefix says so, so a surface can hold its controls', () => {
    expect(mdxStreamToA2ui('<Card title="t">\n<Choice value="a"').settled).toBe(
      false,
    );
    expect(mdxStreamToA2ui(docs[0]).settled).toBe(true);
  });
});
