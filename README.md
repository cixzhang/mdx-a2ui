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

## Status

Nothing here is stable. Every export carries an `experimental_` prefix, the
component catalog is not settled, and the A2UI target is v0.9. It is not
published to npm.

## Licence

MIT
