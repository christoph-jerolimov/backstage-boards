## 1. Implementation

- [x] 1.1 Build `PrincipalPicker` (catalog User/Group options, controlled search, optional `text:` entry, exclude list); verify with tsc and manual smoke
- [x] 1.2 Replace the assignee editor in `ItemDrawer` with removable chips + `PrincipalPicker` (allowText); verify adding a catalog user, adding a `text:` assignee, and removing a chip all persist
- [x] 1.3 Replace the principal `TextField` in `ShareDialog` with `PrincipalPicker` (no text option); verify adding a group grants access

## 2. Verification

- [x] 2.1 tsc, lint, tests green; Playwright smoke of both pickers against the dev catalog
