/**
 * MDX in, A2UI out — the source is parsed, never evaluated.
 *
 * `remark-mdx` yields JSX as syntax: attribute expressions arrive as
 * unevaluated source text. So the failure modes of compiling model-authored
 * MDX (expressions executing, reading the host environment, redefining an
 * allowlisted component, unbounded loops) are absent rather than mitigated —
 * there is no evaluator in the path.
 *
 * Two properties fall out of converting rather than rendering: the allowlist
 * is a real allowlist, and this module emits the component array itself, so
 * `root` is always first — the invariant A2UI streaming needs and that models
 * do not produce unaided.
 */

import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import {unified} from 'unified';

import {CATALOG} from './catalog';
import type {Catalog, CatalogEntry, PropType} from './catalog';

export type A2uiComponent = {
  id: string;
  component: string;
  [key: string]: unknown;
};

export type A2uiMessage =
  | {version: 'v0.9'; createSurface: {surfaceId: string; catalogId: string}}
  | {
      version: 'v0.9';
      updateComponents: {surfaceId: string; components: A2uiComponent[]};
    };

export type ConvertOptions = {
  surfaceId?: string;
  catalog?: Catalog;
  /** Prefix for the data-model paths a TextAnswer binds to. */
  answersPath?: string;
};

export type ConvertResult = {
  errors: string[];
  messages: A2uiMessage[];
};

type MdxNode = {
  type: string;
  name?: string;
  value?: string;
  attributes?: Array<{
    type: string;
    name?: string;
    value?: string | {value?: string} | null;
  }>;
  children?: MdxNode[];
  position?: {
    start?: {line?: number; offset?: number};
    end?: {line?: number; offset?: number};
  };
};

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMdx);

function typeMatches(type: PropType, parsed: unknown): boolean {
  switch (type) {
    case 'boolean':
      return typeof parsed === 'boolean';
    case 'number':
      return typeof parsed === 'number';
    case 'string':
      return typeof parsed === 'string';
    case 'string[]':
      return (
        Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')
      );
    case 'string[][]':
      return (
        Array.isArray(parsed) &&
        parsed.every(
          (row) =>
            Array.isArray(row) && row.every((x) => typeof x === 'string'),
        )
      );
  }
}

function coerce(
  name: string,
  raw: string | {value?: string} | true | null | undefined,
  type: PropType,
  errors: string[],
  where: string,
): unknown {
  if (raw === null || raw === undefined) return undefined;

  // A bare attribute (`multiline`) is boolean true.
  if (raw === true) return type === 'boolean' ? true : undefined;

  if (typeof raw === 'string') {
    if (type === 'string') return raw;
    errors.push(`${where}: ${name} expects ${type}, got a quoted string`);
    return undefined;
  }

  // An expression attribute (`{true}`, `{["a","b"]}`) arrives as source text.
  // Parsing it as JSON — never evaluating it — is the restriction that makes
  // the whole format data rather than code.
  const src = String(raw.value ?? '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(src);
  } catch {
    errors.push(
      `${where}: ${name}={${src.slice(0, 40)}} is not a JSON literal — expressions are not evaluated`,
    );
    return undefined;
  }
  if (!typeMatches(type, parsed)) {
    errors.push(`${where}: ${name} expects ${type}`);
    return undefined;
  }
  return parsed;
}

function readAttrs(
  node: MdxNode,
  spec: CatalogEntry,
  errors: string[],
): Record<string, unknown> {
  const where = `line ${node.position?.start?.line ?? '?'} <${node.name}>`;
  const out: Record<string, unknown> = {};
  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== 'mdxJsxAttribute' || !attribute.name) {
      errors.push(`${where}: spread attributes are not allowed`);
      continue;
    }
    const type = spec.props[attribute.name];
    if (!type) {
      errors.push(
        `${where}: unknown prop "${attribute.name}" (allowed: ${Object.keys(spec.props).join(', ')})`,
      );
      continue;
    }
    const value = coerce(
      attribute.name,
      attribute.value === null ? true : attribute.value,
      type,
      errors,
      where,
    );
    if (value !== undefined) out[attribute.name] = value;
  }
  return out;
}

export function mdxToA2ui(
  source: string,
  options: ConvertOptions = {},
): ConvertResult {
  const surfaceId = options.surfaceId ?? 's';
  const catalog = options.catalog ?? CATALOG;
  const answersPath = options.answersPath ?? '/answers';
  const errors: string[] = [];
  const components: A2uiComponent[] = [];
  const topLevel: string[] = [];
  let counter = 0;
  const id = (prefix: string) => `${prefix}${counter++}`;

  const push = (component: A2uiComponent): string => {
    components.push(component);
    return component.id;
  };

  const emitMarkdown = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    topLevel.push(
      push({id: id('md'), component: 'MarkdownText', text: trimmed}),
    );
  };

  const emitElement = (node: MdxNode): string | null => {
    const spec = node.name ? catalog[node.name] : undefined;
    if (!spec) {
      errors.push(
        `line ${node.position?.start?.line ?? '?'}: unknown component <${node.name}> ` +
          `(allowed: ${Object.keys(catalog).join(', ')})`,
      );
      return null;
    }
    const p = readAttrs(node, spec, errors);
    const kids = (node.children ?? [])
      .filter(
        (child) =>
          child.type === 'mdxJsxFlowElement' ||
          child.type === 'mdxJsxTextElement',
      )
      .map(emitElement)
      .filter((childId): childId is string => Boolean(childId));

    switch (spec.a2ui) {
      case 'container': {
        const head: string[] = [];
        const title = (p.question ?? p.title) as string | undefined;
        if (title) {
          head.push(
            push({id: id('h'), component: 'Text', variant: 'h4', text: title}),
          );
        }
        const column = push({
          id: id('col'),
          component: 'Column',
          children: [...head, ...kids],
        });
        return push({id: id('card'), component: 'Card', child: column});
      }
      case 'button': {
        const label = (p.label as string) ?? 'OK';
        const labelId = push({
          id: id('lbl'),
          component: 'Text',
          variant: 'body',
          text: label,
        });
        return push({
          id: id('btn'),
          component: 'Button',
          child: labelId,
          variant: p.recommended || p.danger ? 'primary' : 'borderless',
          action: {
            event: {
              name: p.danger !== undefined ? 'approve' : 'choose',
              context: {
                value: (p.value as string) ?? label,
                ...(p.danger ? {danger: 'true'} : {}),
              },
            },
          },
        });
      }
      case 'textfield':
        return push({
          id: id('tf'),
          component: 'TextField',
          label: (p.label as string) ?? (p.name as string) ?? '',
          value: {path: `${answersPath}/${(p.name as string) ?? 'text'}`},
          variant: p.multiline ? 'longText' : 'shortText',
        });
      case 'field': {
        const label = push({
          id: id('fl'),
          component: 'Text',
          variant: 'caption',
          text: (p.label as string) ?? '',
        });
        const value = push({
          id: id('fv'),
          component: 'Text',
          variant: 'body',
          text: (p.value as string) ?? '',
        });
        return push({
          id: id('row'),
          component: 'Row',
          children: [label, value],
          justify: 'spaceBetween',
        });
      }
      case 'metric': {
        const label = push({
          id: id('ml'),
          component: 'Text',
          variant: 'caption',
          text: (p.label as string) ?? '',
        });
        const value = push({
          id: id('mv'),
          component: 'Text',
          variant: 'h3',
          text: (p.value as string) ?? '',
        });
        const children = [label, value];
        if (p.delta) {
          children.push(
            push({
              id: id('mdelta'),
              component: 'Text',
              variant: 'caption',
              text: p.delta as string,
            }),
          );
        }
        return push({id: id('mcol'), component: 'Column', children});
      }
      case 'table': {
        const columns = (p.columns as string[]) ?? [];
        const rows = (p.rows as string[][]) ?? [];
        return push({
          id: id('tbl'),
          component: 'Table',
          columns: columns.map((header) => ({header, accessorKey: header})),
          data: rows.map((row) =>
            Object.fromEntries(
              columns.map((header, index) => [header, row[index] ?? '']),
            ),
          ),
        });
      }
      case 'coderef':
        return push({
          id: id('cr'),
          component: 'Text',
          variant: 'caption',
          text: `${(p.path as string) ?? ''}${p.line ? `:${p.line as number}` : ''}`,
        });
      default:
        return null;
    }
  };

  // A malformed document is a conversion error, never a thrown exception:
  // this runs on model output, and a caller rendering a stream must be able
  // to treat "does not convert yet" as an ordinary result.
  let tree: MdxNode;
  try {
    tree = parser.parse(source) as unknown as MdxNode;
  } catch (error) {
    const {line, column, reason} = (error ?? {}) as {
      line?: number;
      column?: number;
      reason?: string;
    };
    errors.push(
      `line ${line ?? '?'}${column ? `:${column}` : ''}: ${reason ?? String(error)}`,
    );
    return {
      errors,
      messages: [
        {version: 'v0.9', createSurface: {surfaceId, catalogId: 'app'}},
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId,
            components: [{id: 'root', component: 'Column', children: []}],
          },
        },
      ],
    };
  }

  // An expression can hide inside a paragraph, not only at the top level, so
  // the whole tree is scanned. Found the hard way: an early version let
  // `Total: {someExpression()}` through as prose.
  const scan = (node: MdxNode) => {
    if (
      node.type === 'mdxTextExpression' ||
      node.type === 'mdxFlowExpression'
    ) {
      errors.push(
        `line ${node.position?.start?.line ?? '?'}: an expression is not allowed — ` +
          'this format is data, not code',
      );
    }
    for (const child of node.children ?? []) scan(child);
  };
  scan(tree);

  // Runs of plain markdown stay together, so prose stays prose instead of
  // being atomised into one component per paragraph.
  let buffer: MdxNode[] = [];
  const flush = () => {
    if (!buffer.length) return;
    const from = buffer[0].position?.start?.offset ?? 0;
    const to = buffer[buffer.length - 1].position?.end?.offset ?? 0;
    emitMarkdown(source.slice(from, to));
    buffer = [];
  };

  for (const node of tree.children ?? []) {
    if (node.type === 'mdxJsxFlowElement') {
      flush();
      const componentId = emitElement(node);
      if (componentId) topLevel.push(componentId);
    } else if (node.type === 'mdxjsEsm' || node.type === 'mdxFlowExpression') {
      flush();
      errors.push(
        `line ${node.position?.start?.line ?? '?'}: ${
          node.type === 'mdxjsEsm' ? 'import/export' : 'an expression'
        } is not allowed — this format is data, not code`,
      );
    } else {
      buffer.push(node);
    }
  }
  flush();

  const ordered: A2uiComponent[] = [
    {id: 'root', component: 'Column', children: topLevel},
    ...components,
  ];

  return {
    errors,
    messages: [
      {version: 'v0.9', createSurface: {surfaceId, catalogId: 'app'}},
      {version: 'v0.9', updateComponents: {surfaceId, components: ordered}},
    ],
  };
}
