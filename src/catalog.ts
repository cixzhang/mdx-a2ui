/**
 * The component catalog, as data.
 *
 * A closed catalog is what makes the format safe to convert rather than
 * evaluate: a component that is not named here is a conversion error, not
 * arbitrary React. Keep it in step with the A2UI catalog it targets.
 */

export type PropType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string[]'
  | 'string[][]';

export type A2uiShape =
  | 'container'
  | 'button'
  | 'textfield'
  | 'field'
  | 'metric'
  | 'table'
  | 'coderef';

export type CatalogEntry = {
  props: Record<string, PropType>;
  children?: boolean;
  a2ui: A2uiShape;
};

export type Catalog = Record<string, CatalogEntry>;

export const CATALOG: Catalog = {
  Ask: {
    props: {question: 'string', id: 'string'},
    children: true,
    a2ui: 'container',
  },
  Choice: {
    props: {value: 'string', label: 'string', recommended: 'boolean'},
    a2ui: 'button',
  },
  TextAnswer: {
    props: {
      name: 'string',
      label: 'string',
      placeholder: 'string',
      multiline: 'boolean',
    },
    a2ui: 'textfield',
  },
  Approve: {props: {label: 'string', danger: 'boolean'}, a2ui: 'button'},
  Card: {props: {title: 'string'}, children: true, a2ui: 'container'},
  Field: {props: {label: 'string', value: 'string'}, a2ui: 'field'},
  Metric: {
    props: {label: 'string', value: 'string', delta: 'string'},
    a2ui: 'metric',
  },
  Table: {props: {columns: 'string[]', rows: 'string[][]'}, a2ui: 'table'},
  CodeRef: {props: {path: 'string', line: 'number'}, a2ui: 'coderef'},
};
