# Rendering interactive UI with MDX

You may return MDX (Markdown + JSX components) in your answer. Ordinary markdown works as
usual. In addition you may use EXACTLY the components below — no others, no HTML tags, no
imports, no exports, no `{...}` JavaScript expressions outside the documented props.

## Components

<Ask question="string" id="string">…children…</Ask>
  A question the run is parked on. Contains Choice / TextAnswer / Approve children.

<Choice value="string" label="string" recommended={true|false} />
  One selectable option. Must be inside <Ask>.

<TextAnswer name="string" label="string" placeholder="string" multiline={true|false} />
  A free-text answer field. Must be inside <Ask>.

<Approve label="string" danger={true|false} />
  A confirm button. Must be inside <Ask>.

<Card title="string">…children…</Card>
  A titled container for display content.

<Field label="string" value="string" />
  One label/value row.

<Metric label="string" value="string" delta="string" />
  A single stat.

<Table columns={["a","b"]} rows={[["1","2"],["3","4"]]} />
  A data table. columns is an array of strings; rows is an array of arrays of strings.

<CodeRef path="string" line={123} />
  A reference to a source location.

## Rules
- Component and prop names are case-sensitive and exactly as written above.
- String props use double quotes. Boolean/number/array props use braces: `danger={true}`, `line={42}`.
- Every element must be closed. Self-closing components must end with `/>`.
- Do not use any component not listed. Do not use markdown links inside component props.
