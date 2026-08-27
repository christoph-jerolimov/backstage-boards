# Design

The single-assignee name in `AssigneeAvatars` is wrapped in
`EntityRefLink` (children = resolved display name) inside a
stop-propagation span, mirroring the avatar stack. Everything else is
unchanged; the drawer's chips already link via the same component.
