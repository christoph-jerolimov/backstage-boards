# Duplicate Permission Semantics

## Why

Copying share settings currently clones the source's admin grants
verbatim, so other people's admin rights carry over to the copy. The
duplicator should start as the copy's sole admin; copied rules are
additions, not a transfer of control.

## What Changes

- Duplicating a board always makes the current user the copy's first
  (admin) permission — as before — and copied share entries are added on
  top of it.
- Copied entries whose level is admin (other than the current user) are
  downgraded to write in the copy; read/write entries copy unchanged.

## Impact

- `boards-backend`: permission cloning in `duplicateBoard`; tests.
