## 1. Implementation

- [x] 1.1 `extractMentions` in boards-common with unit tests (full refs, shorthand, dedupe, email non-match)
- [x] 1.2 Backend mention notifications on comment add/edit and description change, watcher-dedupe, actor exclusion; service tests for the three spec scenarios
- [x] 1.3 Renderer mention tokens as entity links; markdown tests

## 2. Verification

- [x] 2.1 tsc, lint, tests green; live check: comment with @mention produces a notification for a non-watching user
