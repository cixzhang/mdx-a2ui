/**
 * Render an A2UI component array with Astryx.
 *
 * This lives in the demo rather than in the library on purpose: the converter
 * emits ordinary A2UI, and A2UI already has renderers for several design
 * systems. Making one of them a dependency would trade the format's whole
 * point for a shortcut.
 *
 * The data model is host-owned. A TextField names a slot (`/answers/why`) and
 * never holds the value; this module keeps the values and hands them back with
 * the action. A document therefore cannot read what the user typed — it can
 * only say where to put it.
 */

import * as React from 'react';
import htm from 'htm';
import {
  Badge,
  Button,
  Card,
  Heading,
  Markdown,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  TextArea,
  TextInput,
} from '@astryxdesign/core';

const h = htm.bind(React.createElement);

const HEADING_LEVEL = {h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6};

function valueAtPath(model, path) {
  return model[path] ?? '';
}

/**
 * @param {{
 *   components: Array<Record<string, unknown>>,
 *   isStreaming?: boolean,
 *   model: Record<string, string>,
 *   onModelChange: (path: string, value: string) => void,
 *   onAction: (action: {name: string, context: Record<string, string>, answers: Record<string, string>}) => void,
 * }} props
 */
export function A2uiSurface({
  components,
  isStreaming = false,
  model,
  onModelChange,
  onAction,
}) {
  const byId = new Map(components.map((c) => [c.id, c]));

  const renderChildren = (ids) =>
    (ids ?? []).map((id) => render(id)).filter(Boolean);

  function render(id) {
    const node = byId.get(id);
    if (!node) return null;
    const key = node.id;

    switch (node.component) {
      case 'Column':
        return h`<${Stack} key=${key} direction="vertical" gap=${3} align="stretch">
          ${renderChildren(node.children)}
        </${Stack}>`;

      case 'Row':
        return h`<${Stack} key=${key} direction="horizontal" gap=${3} justify=${
          node.justify === 'spaceBetween' ? 'space-between' : 'start'
        }>
          ${renderChildren(node.children)}
        </${Stack}>`;

      case 'Card':
        return h`<${Card} key=${key} padding=${4} elevation="low">
          ${render(node.child)}
        </${Card}>`;

      case 'MarkdownText':
        // Astryx's own Markdown, in streaming mode while the document is still
        // arriving — it is what keeps a half-written line from flickering.
        return h`<${Markdown} key=${key} isStreaming=${isStreaming} headingLevelStart=${3}>
          ${node.text}
        </${Markdown}>`;

      case 'Text': {
        const level = HEADING_LEVEL[node.variant];
        if (level) {
          return h`<${Heading} key=${key} level=${level}>${node.text}</${Heading}>`;
        }
        return h`<${Text} key=${key} type=${
          node.variant === 'caption' ? 'supporting' : 'body'
        }>${node.text}</${Text}>`;
      }

      case 'Button': {
        const label = byId.get(node.child)?.text ?? 'OK';
        const event = node.action?.event ?? {};
        const isRecommended =
          node.variant === 'primary' && event.name === 'choose';
        const isDangerous = event.context?.danger === 'true';
        return h`<${Stack} key=${key} direction="horizontal" gap=${2} align="center">
          <${Button}
            label=${label}
            variant=${isDangerous ? 'destructive' : node.variant === 'primary' ? 'primary' : 'secondary'}
            isDisabled=${isStreaming}
            tooltip=${isStreaming ? 'Still arriving' : undefined}
            onClick=${() =>
              onAction({
                name: event.name ?? 'choose',
                context: event.context ?? {},
                answers: model,
              })} />
          ${isRecommended ? h`<${Badge} label="Recommended" variant="info" />` : null}
        </${Stack}>`;
      }

      case 'TextField': {
        const path = node.value?.path ?? '';
        const Field = node.variant === 'longText' ? TextArea : TextInput;
        return h`<${Field}
          key=${key}
          label=${node.label}
          value=${valueAtPath(model, path)}
          isDisabled=${isStreaming}
          onChange=${(next) => onModelChange(path, next)} />`;
      }

      case 'Table':
        return h`<${Table} key=${key} density="compact" dividers="horizontal">
          <${TableHeader}>
            <${TableRow} isHeaderRow=${true}>
              ${(node.columns ?? []).map(
                (column) =>
                  h`<${TableHeaderCell} key=${column.header}>${column.header}</${TableHeaderCell}>`,
              )}
            </${TableRow}>
          </${TableHeader}>
          <${TableBody}>
            ${(node.data ?? []).map(
              (row, index) => h`<${TableRow} key=${index}>
                ${(node.columns ?? []).map(
                  (column) =>
                    h`<${TableCell} key=${column.header}>${row[column.accessorKey] ?? ''}</${TableCell}>`,
                )}
              </${TableRow}>`,
            )}
          </${TableBody}>
        </${Table}>`;

      default:
        // A component the converter can emit but this renderer has not learned
        // yet. Say so — silently dropping it would look like a converter bug.
        return h`<${Badge}
          key=${key}
          variant="error"
          label=${`No renderer for ${String(node.component)}`} />`;
    }
  }

  return render('root');
}
