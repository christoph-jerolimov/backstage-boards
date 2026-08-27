# Tag Editing with TagGroup and SearchAutocomplete

## Why

Tags are edited as one comma-separated text field — easy to mangle, no
per-tag removal, no suggestions.

## What Changes

- The drawer's Tags section becomes a Backstage UI `TagGroup`: each tag
  is a `Tag` with a remove affordance (`onRemove`).
- After the tags an "Add" button toggles into a `SearchAutocomplete`
  suggesting the board's other tags. Enter adds the typed text directly
  as a new tag; picking a suggestion adds it; Escape closes the
  autocomplete and returns focus to the Add button.

## Impact

- `plugins/boards`: new `TagsEditor` component; ItemDrawer uses it (tag
  suggestions passed from BoardPage's items).
