# @-Mentions in Comments and Descriptions

## Why

There is no way to pull a specific person into an item. @-mentions with direct notifications reach people even when they are not watching the item or board.

## What Changes

- Comments and item descriptions support @-mentions: `@user:default/jane`, `@group:default/team-a`, or the shorthand `@jane` (resolved as `user:default/jane`).
- Mentioned users/groups receive a "You were mentioned" notification when the comment or description is saved — regardless of watch state; the actor is never notified about their own mention, and mentioned principals are not double-notified by the regular watcher notification of the same event.
- The markdown renderer displays mentions as catalog entity links.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/watching-and-notifications`: mentions notify the mentioned principals independently of watches.
- `boards/comments-and-history`: mention syntax renders as entity links in comments and descriptions.

## Impact

- `plugins/boards-common`: `extractMentions` helper with tests.
- `plugins/boards-backend`: mention notifications on comment add/edit and description change; tests.
- `plugins/boards`: mention tokens in the markdown renderer.
