# Design

`duplicateBoard` already inserts the duplicator's admin grant first via
`createBoard` and skips source rows for refs that already exist on the
copy (which keeps the duplicator's admin untouched). The only change:
cloned rows map `level: 'admin'` to `'write'` before insertion.
