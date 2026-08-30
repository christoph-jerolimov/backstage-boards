# boards/comments-and-history Delta

## ADDED Requirements

### Requirement: Rich text editing and rendering
The item description and comments (composing, editing) SHALL be edited in a rich text editor that shows formatting as it is applied. The editor SHALL support at least: bold, italics, headings, ordered and unordered lists, links, inline code, code blocks, and tables, and SHALL convert the corresponding markdown shortcut syntax (e.g. `**bold**`, `# ` headings, `` ` `` code, pipe-table rows) as it is typed.

`#tags` SHALL be visually highlighted and `@`-entity references SHALL be highlighted and rendered as catalog entity links, in the editor and in rendered content alike. Typing `@` in the editor SHALL open an entity search autocompletion over the catalog; selecting a result SHALL insert that entity's mention.

Read-only display of descriptions, comments, and their stored versions SHALL be rendered through the same editor engine with editing disabled, so edit and view modes present the content identically. Raw HTML SHALL NOT be rendered.

Content SHALL continue to be stored, versioned, and drafted as markdown text: the editor SHALL load existing markdown and SHALL save markdown that round-trips through the supported element set, so existing content, mention notifications, and drafts keep working unchanged.

#### Scenario: Markdown shortcuts convert while typing
- **WHEN** a user types `# ` at the start of a line followed by text, or wraps a word in `**`
- **THEN** the editor immediately shows a heading or bold text rather than the literal markers

#### Scenario: Mention autocompletion
- **WHEN** a user types `@` followed by a few characters in the description or a comment
- **THEN** a search over catalog entities opens, and selecting a result inserts a highlighted mention of that entity

#### Scenario: Hashtag highlighted
- **WHEN** a comment contains `#frontend`
- **THEN** the tag is visually highlighted in the editor and in the rendered comment

#### Scenario: Read-only uses the same engine
- **WHEN** a saved description containing a heading, a table, a code block, a `#tag`, and an `@mention` is displayed read-only
- **THEN** it renders through the same editor component with editing disabled, showing the same formatting as during editing, with the mention linking to the entity's catalog page

#### Scenario: Storage stays markdown
- **WHEN** a user saves an edited description or comment
- **THEN** the persisted value is markdown text, an existing markdown value loads into the editor with its formatting intact, and mentioned users/groups are notified exactly as before
