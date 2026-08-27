# Design

The drawer's assignee chip renders `<AssigneeAvatars refs={[ref]} />`
for catalog refs — the component's single-assignee mode is exactly
avatar + linked name — and keeps `RefDisplay` for `text:` refs to avoid
a badge-inside-chip look. Remove buttons are unchanged.
