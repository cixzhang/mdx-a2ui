# mdx-a2ui

**Experimental.** Convert MDX — prose with a closed set of components in it —
into [A2UI](https://a2ui.org/) JSON. The source is **parsed, never evaluated**.

```
agent writes MDX  →  repair (if still streaming)  →  convert  →  A2UI JSON  →  any A2UI renderer
```

## Why

Two formats, each good at a different thing:

- **MDX** is a better authoring surface for an agent. Prose stays prose, and only
  the interactive part becomes a component. It is ~2.5x denser than the A2UI it
  produces — context the model pays for on every replay.
- **A2UI** is a better data model. It has a schema, a validator, renderers for
  several design systems, and clients that are not a web browser.

Compiling model-authored MDX to get the first one costs you the second one, and
it is not safe: an MDX document is code, and `evaluate()` runs it. Converting
instead of compiling keeps both. An attribute expression arrives from
`remark-mdx` as *source text*, and this library only accepts it if it parses as
a JSON literal — so there is no evaluator in the path to abuse.

## Usage

```ts
import {
  experimental_mdxToA2ui,
  experimental_mdxStreamToA2ui,
} from 'mdx-a2ui';

// A settled document.
const {errors, messages} = experimental_mdxToA2ui(source);

// A document still arriving: heal the syntax, then convert.
const {messages, settled} = experimental_mdxStreamToA2ui(prefix);
```

`messages` is an A2UI v0.9 pair — `createSurface` then `updateComponents` —
ready for a validator and a renderer. `errors` is never thrown and never
partial-and-silent: a document that does not convert says which line, and what
was allowed there instead.

`settled` is false while the document is still arriving. A partially arrived
card can show some but not all of its buttons, so a surface that accepts
answers must not enable controls until it is true.

The component vocabulary a model is given is in
[`docs/AUTHORING.md`](docs/AUTHORING.md); it is the same catalog the converter
enforces.

## What it does, measured

Over 12 model-authored documents (`fixtures/llmdocs.json`, written one-pass by
two models against `docs/AUTHORING.md`) and every 8-byte prefix of each:

| | |
|---|---|
| documents that convert clean, schema-shaped, `root` first | 12 / 12 |
| ten escape-hatch probes (expressions, `process.env`, component override, imports, unbounded loop) | 10 / 10 refused, no side effects |
| raw prefixes that convert | 24% |
| repaired prefixes that convert | 100% |
| prefixes that paint something | 100%, first paint at ~1% of arrival |

The last two rows are the reason both halves exist. Without the repair a
truncated prefix is refused — correct, but it renders nothing while the answer
is arriving. Without the converter's root-first emission, A2UI written by a
model paints at 99% of arrival or never: models put `root` last, or misname it.

## The demo

[**cixzhang.github.io/mdx-a2ui**](https://cixzhang.github.io/mdx-a2ui/) —
the same conversion, rendered with [Astryx](https://astryx.dev). Drag the
slider to replay a document byte by byte, or paste an
[OpenRouter](https://openrouter.ai/keys) key and have a model write a live one.

The page is `demo/`: static files, no framework, everything third-party loaded
from a CDN through an import map. The key lives in this browser's localStorage
and is sent only to openrouter.ai — GitHub Pages is static, so there is no
server that could receive it.

`demo/render.js` is ~150 lines mapping A2UI onto Astryx components, and it is
in the demo rather than in the library on purpose: the converter emits ordinary
A2UI, which already has renderers for several design systems. Making one of
them a dependency would trade the format's whole point for a shortcut.

```
npm install && npm run build:demo
npx http-server demo -p 4599
```

## Status

Nothing here is stable. Every export carries an `experimental_` prefix, the
component catalog is not settled, and the A2UI target is v0.9. It is not
published to npm.

## Licence

MIT
