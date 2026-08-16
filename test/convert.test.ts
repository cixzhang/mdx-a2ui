import {describe, expect, test} from 'vitest';

import llmdocs from '../fixtures/llmdocs.json';
import {experimental_mdxToA2ui as mdxToA2ui} from '../src';
import type {A2uiComponent} from '../src';

const docs = Object.entries(llmdocs as Record<string, string>);

function components(source: string): A2uiComponent[] {
  const {messages} = mdxToA2ui(source);
  const update = messages[1] as {
    updateComponents: {components: A2uiComponent[]};
  };
  return update.updateComponents.components;
}

describe('model-authored documents', () => {
  test.each(docs)('%s converts with no errors', (_name, source) => {
    expect(mdxToA2ui(source).errors).toEqual([]);
  });

  test.each(docs)('%s emits root first', (_name, source) => {
    const emitted = components(source);
    expect(emitted[0].id).toBe('root');
    expect(emitted.filter((c) => c.id === 'root')).toHaveLength(1);
  });

  test.each(docs)('%s references only ids it emits', (_name, source) => {
    const emitted = components(source);
    const ids = new Set(emitted.map((c) => c.id));
    for (const component of emitted) {
      const referenced = [
        ...((component.children as string[] | undefined) ?? []),
        ...(component.child ? [component.child as string] : []),
      ];
      for (const reference of referenced) {
        expect(ids, `${component.id} → ${reference}`).toContain(reference);
      }
    }
  });
});

describe('prose stays prose', () => {
  test('a run of markdown becomes one MarkdownText, not one per paragraph', () => {
    const emitted = components(
      'First paragraph.\n\nSecond paragraph.\n\n- a\n- b\n\n<Choice value="x" label="X" />\n',
    );
    const markdown = emitted.filter((c) => c.component === 'MarkdownText');
    expect(markdown).toHaveLength(1);
    expect(markdown[0].text).toContain('Second paragraph');
  });

  test('a GFM table survives as markdown rather than being atomised', () => {
    const emitted = components('| a | b |\n| - | - |\n| 1 | 2 |\n');
    expect(emitted.filter((c) => c.component === 'MarkdownText')).toHaveLength(
      1,
    );
  });
});

describe('the catalog is a real allowlist', () => {
  test('an unknown component is refused, with the allowed list', () => {
    const {errors} = mdxToA2ui('<Fancy title="x" />\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('unknown component <Fancy>');
    expect(errors[0]).toContain('Ask');
  });

  test('an unknown prop is refused, with the allowed props', () => {
    const {errors} = mdxToA2ui('<Choice value="a" label="A" onClick="go" />\n');
    expect(errors[0]).toContain('unknown prop "onClick"');
    expect(errors[0]).toContain('recommended');
  });

  test('a wrong prop type is refused, with the expected type', () => {
    const {errors} = mdxToA2ui('<CodeRef path="a.ts" line="12" />\n');
    expect(errors[0]).toContain('line expects number');
  });

  test('every refusal carries a line number', () => {
    const {errors} = mdxToA2ui('Some prose.\n\nMore prose.\n\n<Fancy />\n');
    expect(errors[0]).toMatch(/^line 5:/);
  });
});

describe('typed attribute values', () => {
  test('a JSON literal expression is accepted', () => {
    const emitted = components(
      '<Table columns={["a","b"]} rows={[["1","2"]]} />\n',
    );
    const table = emitted.find((c) => c.component === 'Table');
    expect((table?.columns as Array<{header: string}>).map((c) => c.header)).toEqual(['a', 'b']);
    expect(table?.data).toEqual([{a: '1', b: '2'}]);
  });

  test('a bare attribute is boolean true', () => {
    const emitted = components('<TextAnswer name="why" multiline />\n');
    const field = emitted.find((c) => c.component === 'TextField');
    expect(field?.variant).toBe('longText');
  });

  test('a TextField binds to a host-owned path, never to a value', () => {
    const emitted = components('<TextAnswer name="why" label="Why?" />\n');
    const field = emitted.find((c) => c.component === 'TextField');
    expect(field?.value).toEqual({path: '/answers/why'});
  });
});
