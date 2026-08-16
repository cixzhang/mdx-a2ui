/**
 * The demo: watch a document arrive, and watch it become UI as it arrives.
 *
 * The slider replays a settled document byte by byte; the OpenRouter panel
 * streams a live one. Both take the same path — repair, convert, render —
 * because that path is the thing being demonstrated, not a display mode.
 */

import * as React from 'react';
import {createRoot} from 'react-dom/client';
import htm from 'htm';
import {
  Badge,
  Banner,
  Button,
  Card,
  Divider,
  Heading,
  Link,
  Selector,
  Stack,
  Switch,
  Text,
  TextInput,
  Theme,
} from '@astryxdesign/core';
import {neutralTheme} from '@astryxdesign/theme-neutral';
import {
  experimental_mdxStreamToA2ui as mdxStreamToA2ui,
  experimental_mdxToA2ui as mdxToA2ui,
} from 'mdx-a2ui';

import {A2uiSurface} from './render.js';
import {AUTHORING_PROMPT, EXAMPLES} from './examples.js';
import {loadSettings, saveSettings, streamMdx} from './openrouter.js';

const h = htm.bind(React.createElement);
const {useCallback, useEffect, useMemo, useRef, useState} = React;

function componentsOf(messages) {
  const update = messages.find((m) => m.updateComponents);
  return update?.updateComponents.components ?? [];
}

function Pane({title, subtitle, badge, children}) {
  return h`<${Card} padding=${4} elevation="low" height="100%">
    <${Stack} direction="vertical" gap=${3} align="stretch" height="100%">
      <${Stack} direction="horizontal" gap=${2} align="center" justify="space-between">
        <${Stack} direction="vertical" gap=${0}>
          <${Heading} level=${2}>${title}</${Heading}>
          ${subtitle ? h`<${Text} type="supporting">${subtitle}</${Text}>` : null}
        </${Stack}>
        ${badge ?? null}
      </${Stack}>
      ${children}
    </${Stack}>
  </${Card}>`;
}

/**
 * The source pane shows the real bytes and what the repair did to them:
 * what arrived, what could not be salvaged (struck through), and what was
 * appended (grey). The repair only ever cuts back or appends, so those three
 * runs describe it completely.
 */
function Source({sent, repair}) {
  const dropped = repair?.dropped ?? 0;
  const kept = sent.slice(0, sent.length - dropped);
  const cut = dropped ? sent.slice(sent.length - dropped) : '';
  const appended = (repair?.text ?? sent).slice(kept.length);
  // One expression, not three lines of template: `pre` preserves whitespace,
  // so any indentation here would show up in the document.
  return h`<pre className="mdx-source">${[
    kept,
    cut ? h`<span key="c" className="dropped">${cut}</span>` : null,
    appended ? h`<span key="a" className="repair">${appended}</span>` : null,
  ]}</pre>`;
}

function App() {
  const [exampleId, setExampleId] = useState(EXAMPLES[0].id);
  const [live, setLive] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [percent, setPercent] = useState(100);
  const [autoClose, setAutoClose] = useState(true);
  const [model, setModel] = useState({});
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(loadSettings);
  const [prompt, setPrompt] = useState(
    'Ask me which of three rollout strategies to take, with a short table comparing them.',
  );
  const abort = useRef(null);

  const example = EXAMPLES.find((e) => e.id === exampleId) ?? EXAMPLES[0];
  const full = live || example.source;

  // While a live document is arriving the slider is meaningless — the stream
  // itself is the prefix.
  const prefix = live ? full : full.slice(0, Math.ceil((full.length * percent) / 100));

  const result = useMemo(
    () => (autoClose ? mdxStreamToA2ui(prefix) : {...mdxToA2ui(prefix), settled: true, repair: {text: prefix}}),
    [prefix, autoClose],
  );

  const components = componentsOf(result.messages);
  const unsettled = isStreaming || !result.settled;

  useEffect(() => {
    setModel({});
    setSent(null);
  }, [exampleId]);

  const run = useCallback(async () => {
    if (!settings.apiKey) {
      setError('Add an OpenRouter key first — it is stored in this browser only.');
      return;
    }
    setError(null);
    setLive('');
    setSent(null);
    setIsStreaming(true);
    abort.current = new AbortController();
    try {
      await streamMdx({
        prompt,
        system: AUTHORING_PROMPT,
        settings,
        signal: abort.current.signal,
        onText: setLive,
      });
    } catch (e) {
      if (e.name !== 'AbortError') setError(String(e.message ?? e));
    } finally {
      setIsStreaming(false);
    }
  }, [prompt, settings]);

  return h`<${Stack} direction="vertical" gap=${5} padding=${6} maxWidth=${1180}>
    <${Stack} direction="vertical" gap=${1}>
      <${Heading} level=${1}>mdx-a2ui</${Heading}>
      <${Text} type="supporting">
        MDX in, A2UI out, rendered with Astryx. The JSX is parsed, never
        evaluated — so an expression, an import or an unknown component is a
        refusal with a line number rather than something that runs.
        ${' '}<${Link} href="https://github.com/cixzhang/mdx-a2ui">Source</${Link}>
      </${Text}>
    </${Stack}>

    <${Card} padding=${4} elevation="low">
      <${Stack} direction="vertical" gap=${3} align="stretch">
        <${Stack} direction="horizontal" gap=${3} align="end" wrap="wrap">
          <${Selector}
            label="Example"
            value=${exampleId}
            options=${EXAMPLES.map((e) => ({value: e.id, label: e.label}))}
            isDisabled=${Boolean(live)}
            onChange=${(v) => setExampleId(v)}
            width=${260} />
          <${Switch}
            label="Repair the truncated tail"
            value=${autoClose}
            onChange=${setAutoClose} />
          ${live
            ? h`<${Button}
                label="Back to the examples"
                variant="secondary"
                onClick=${() => {
                  setLive('');
                  setSent(null);
                }} />`
            : null}
        </${Stack}>

        ${live
          ? null
          : h`<${Stack} direction="vertical" gap=${1}>
              <${Text} type="label">Arrived: ${percent}%</${Text}>
              <input
                type="range"
                min="0"
                max="100"
                value=${percent}
                aria-label="How much of the document has arrived"
                style=${{width: '100%'}}
                onChange=${(e) => setPercent(Number(e.target.value))} />
            </${Stack}>`}
      </${Stack}>
    </${Card}>

    <${Stack} direction="horizontal" gap=${4} align="stretch" wrap="wrap">
      <${Stack} direction="vertical" width=${520} minHeight=${320}>
        <${Pane}
          title="MDX"
          subtitle=${autoClose ? 'grey text is the repair, appended' : 'raw, unrepaired'}
          badge=${h`<${Badge}
            label=${result.errors.length ? `${result.errors.length} refused` : 'converts'}
            variant=${result.errors.length ? 'warning' : 'success'} />`}>
          <${Source} sent=${prefix} repair=${result.repair} />
        </${Pane}>
      </${Stack}>

      <${Stack} direction="vertical" width=${560} minHeight=${320}>
        <${Pane}
          title="Astryx"
          subtitle=${
            result.errors.length
              ? 'refused'
              : unsettled
                ? 'still arriving — controls are held'
                : 'settled'
          }
          badge=${unsettled ? h`<${Badge} label="streaming" variant="info" />` : null}>
          ${result.errors.length
            ? h`<${Banner}
                status="warning"
                title="This document does not convert"
                description=${result.errors[0]} />`
            : null}
          <${A2uiSurface}
            components=${components}
            isStreaming=${unsettled}
            model=${model}
            onModelChange=${(path, value) =>
              setModel((m) => ({...m, [path]: value}))}
            onAction=${(action) => setSent(action)} />
          ${sent
            ? h`<${Banner}
                status="success"
                title="Sent to the session"
                description=${`[a2ui:${sent.context.value ?? sent.name}] ${JSON.stringify(sent.answers)}`} />`
            : null}
        </${Pane}>
      </${Stack}>
    </${Stack}>

    <${Divider} />

    <${Card} padding=${4} elevation="low">
      <${Stack} direction="vertical" gap=${3} align="stretch">
        <${Stack} direction="vertical" gap=${0}>
          <${Heading} level=${2}>Have a model write one</${Heading}>
          <${Text} type="supporting">
            Your OpenRouter key is kept in this browser's localStorage and sent
            only to openrouter.ai. This page is static; there is no server to
            send it to.
          </${Text}>
        </${Stack}>
        <${Stack} direction="horizontal" gap=${3} align="end" wrap="wrap">
          <${TextInput}
            label="OpenRouter key"
            type="password"
            placeholder="sk-or-v1-…"
            value=${settings.apiKey}
            width=${300}
            onChange=${(v) => {
              const next = {...settings, apiKey: v};
              setSettings(next);
              saveSettings(next);
            }} />
          <${TextInput}
            label="Model"
            value=${settings.model}
            width=${260}
            onChange=${(v) => {
              const next = {...settings, model: v};
              setSettings(next);
              saveSettings(next);
            }} />
        </${Stack}>
        <${TextInput}
          label="Ask for something"
          value=${prompt}
          onChange=${setPrompt} />
        <${Stack} direction="horizontal" gap=${2}>
          <${Button}
            label=${isStreaming ? 'Writing…' : 'Write it'}
            variant="primary"
            isLoading=${isStreaming}
            onClick=${run} />
          ${isStreaming
            ? h`<${Button}
                label="Stop"
                variant="secondary"
                onClick=${() => abort.current?.abort()} />`
            : null}
        </${Stack}>
        ${error
          ? h`<${Banner} status="error" title="That did not work" description=${error} />`
          : null}
      </${Stack}>
    </${Stack}>
  </${Stack}>`;
}

export function boot(element) {
  createRoot(element).render(
    h`<${Theme} theme=${neutralTheme} mode="system"><${App} /></${Theme}>`,
  );
}
