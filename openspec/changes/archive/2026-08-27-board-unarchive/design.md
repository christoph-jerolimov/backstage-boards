# Design

`unarchiveBoard` mirrors `hardDeleteBoard`'s access pattern (read gate,
explicit admin re-check since archived boards bypass write gates),
requires `archived_at`, clears `archived_at`/`archived_by`, bumps
`updated_at`, and emits the board signal. Route `POST
/boards/:boardId/unarchive`; client `unarchiveBoard(boardId)`. The
alert's custom actions become [Unarchive (secondary), Delete now
(destructive)].
