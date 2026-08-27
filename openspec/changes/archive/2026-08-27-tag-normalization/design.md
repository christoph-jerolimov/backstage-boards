# Design

`normalizeTags(tags)` in boards-common removes all `#` characters, trims,
drops empties, and dedupes preserving order. The backend applies it in
`writeAssociations` (single write path for create/update) and in
`updateItem`'s change-diff computation so recorded old/new values match
what is stored. Displays join tags with `, ` instead of prefixing `#`.
