# Design

## Component

`AssigneeAvatars` (new file `plugins/boards/src/components/AssigneeAvatars.tsx`):

- Splits refs into catalog refs (`user:`/`group:`) and `text:` refs.
- Catalog refs are resolved through `catalogApi.getEntitiesByRefs` via a
  TanStack Query keyed on the sorted ref list (`['boards','profiles',...]`,
  5 min staleTime) fetching only `metadata`, `kind`, and `spec.profile`.
- Display name: `spec.profile.displayName` → `metadata.title` →
  `metadata.name` → the name segment parsed from the ref. Picture:
  `spec.profile.picture` (BUI `Avatar` falls back to initials generated
  from the display name when the image is missing or fails to load).
- One catalog assignee: `Avatar` + display name, both wrapped in an
  `EntityRefLink`.
- Multiple: overlapping stack (negative margin), each avatar wrapped in
  `EntityRefLink` inside a BUI `TooltipTrigger`/`Focusable` so the BUI
  `Tooltip` shows the display name; hover/focus raises the avatar
  (`z-index`, slight scale, focus ring) via a one-off injected `<style>`
  tag, since the plugin uses inline styles and pseudo-classes need CSS.
- `text:` refs keep the existing `Badge` chips next to the stack.
- The container stops click propagation so clicking an avatar navigates to
  the entity instead of opening the item drawer.

## Alternatives considered

- Native `title` attribute instead of BUI tooltip: rejected, BUI tooltip
  matches the design system and is keyboard-accessible via `Focusable`.
- Fetching each entity separately per avatar: rejected, one
  `getEntitiesByRefs` batch per ref-list avoids request storms on large
  boards.
