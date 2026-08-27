# Design

## Context

See proposal. Notifications already fan out to watchers from `BoardsService`; the markdown tokenizer already auto-links bare entity refs.

## Goals / Non-Goals

**Goals:** deterministic mention extraction shared between backend and renderer; direct notifications; link rendering.
**Non-Goals:** typeahead mention picker in the editor (future); mention-only notification preferences.

## Decisions

- `extractMentions(text)` in boards-common: matches `@<entity-ref>` (user/group kinds) and `@<name>` shorthand → `user:default/<name>`, at start or after whitespace/punctuation; dedupes; no catalog lookup (deterministic, works in both runtimes). Code spans are not excluded (acceptable simplification).
- Backend: `notifyMentions` helper called from `addComment`, `updateComment`, and the description branch of `updateItem`. It excludes the actor, sends `title: "You were mentioned"` with the item link, and returns the mentioned refs so `notifyWatchers` can exclude them from the same event's watcher notification.
- Renderer: the autolink pass first splits out `@…` mention tokens (rendered as entity links using the resolved ref, displayed without the `@`), then applies the existing bare-ref linking to the rest.

## Risks / Trade-offs

- [Shorthand assumes the default namespace] → documented; full refs always work.
- [False positives like emails (`a@b`)] → mention must follow start/whitespace, so `a@b` does not match.
