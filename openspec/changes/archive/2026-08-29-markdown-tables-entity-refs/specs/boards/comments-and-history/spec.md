# boards/comments-and-history Delta

## MODIFIED Requirements

### Requirement: Comments on items
Users with write access SHALL be able to add comments to an item. A comment SHALL record its author and creation time and SHALL render a markdown subset (at minimum: emphasis, bold, inline code, code blocks, links, lists, headings, and tables; raw HTML SHALL NOT be rendered).

Headings SHALL follow the ATX form (`#` through `######` at the start of a line, followed by a space) and SHALL render as styled heading elements of decreasing prominence. Tables SHALL follow the GitHub pipe form — a header row, a separator row of dashes (e.g. `| --- | --- |`), and zero or more body rows — and SHALL render as tables with a distinguishable header row. Table cells SHALL support the inline markdown subset and the same entity auto-linking and mention rendering as other text. A pipe line without a following separator row SHALL NOT be treated as a table.

#### Scenario: Add a comment
- **WHEN** a user with write access submits a comment on an item
- **THEN** the comment is persisted with author and timestamp and appears in the item's timeline

#### Scenario: Read-only user cannot comment
- **WHEN** a user with only read access attempts to add a comment
- **THEN** the request is rejected with a permission error

#### Scenario: Heading renders
- **WHEN** a comment or description contains a line `## Rollout plan`
- **THEN** it renders as a heading element, more prominent than paragraph text

#### Scenario: Table renders
- **WHEN** a comment or description contains a pipe table with a header row, a `| --- |` separator row, and body rows
- **THEN** it renders as a table whose header row is visually distinct and whose cells render inline formatting and entity links

#### Scenario: Pipe text without separator stays a paragraph
- **WHEN** a comment contains a single line with pipes but no following separator row
- **THEN** the line renders as ordinary paragraph text, not a table

### Requirement: Mention rendering
@-mentions in comments and descriptions SHALL render as links to the mentioned catalog entity, alongside the existing bare entity-ref auto-linking. Mentions SHALL accept full entity refs of any kind — `@<kind>:<name>` and `@<kind>:<namespace>/<name>` (e.g. `@component:webserver-example`, `@group:default/another-team`) — with a missing namespace resolving to `default`, and the bare `@name` shorthand SHALL continue to resolve to `user:default/<name>`. `text:` refs remain unlinked.

#### Scenario: Mention renders as entity link
- **WHEN** a comment containing `@user:default/jane` or `@jane` is rendered
- **THEN** the mention appears as a link to that user's catalog page

#### Scenario: Non-principal entity mention renders as entity link
- **WHEN** a comment containing `@component:webserver-example` is rendered
- **THEN** the mention appears as a link to `component:default/webserver-example`'s catalog page

#### Scenario: Sentence punctuation stays out of the ref
- **WHEN** a comment ends with `owned by @group:default/guests.`
- **THEN** the mention links `group:default/guests` and the trailing period renders as plain text
