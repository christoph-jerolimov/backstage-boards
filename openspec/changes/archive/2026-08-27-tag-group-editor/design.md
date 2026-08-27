# Design

`TagsEditor` props: `tags`, `canEdit`, `suggestions`, `onChange`.
Rendering: `TagGroup` (`onRemove` filters the removed keys) with one
`Tag id={tag}` per tag; then either the Add button or a controlled
`SearchAutocomplete` whose items are the unused suggestions filtered by
the input. A capture-phase keydown wrapper implements the spec exactly:
Enter adds the normalized typed value (input clears, editor stays open
for the next tag), Escape hides the autocomplete and refocuses Add
(ref + rAF). Saves go through the existing `updateItem` (tags are
normalized server-side). ItemDrawer replaces its TextField editing;
BoardPage passes the board-wide tag list as suggestions.
