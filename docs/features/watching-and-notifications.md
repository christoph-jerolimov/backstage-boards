# Watching and notifications

Boards uses the standard Backstage notifications system, so everything
described here arrives in the portal's **Notifications** area (and through
whatever channels your Backstage instance forwards notifications to).

## Watching boards and items

The **Watch** control in the board header watches the whole board; the same
control in the [item details drawer](item-details.md) header (and the item
menu) watches a single item. Watching a board covers all its items;
watching an item covers just that one.

When a watched item changes — fields, moves, comments, archival — the
watchers get a Backstage notification describing the change. Notifications
are grouped per user, so a burst of edits does not become a burst of
messages, and you are never notified about your own changes.

The watch control is a split button: its main segment toggles your own
watch state, and its dropdown lists everyone currently watching, so it is
always visible who is following a board or an item.

## Mention notifications

`@`-mentioning a user in a comment notifies them directly, whether or not
they watch the item — see
[Comments and history](comments-and-history.md).

## Scheduled reminders

Admins can configure recurring reminders about assigned items — for
example, every weekday morning each user gets one message per board listing
their overdue items. Reminders are entirely server-side and opt-in per
deployment; users can be excluded via a label on their user entity. The
options are described in [Configuration](../configuration.md).

## Live updates

Open board views refresh automatically: whenever a board's content changes,
the backend publishes a lightweight signal (ids only, no content) over the
Backstage signals plugin, and every open view of that board re-fetches its
data. Two people working on the same board see each other's changes within
moments, without reloading — and because the signal carries no board
content, data access stays behind the permission-checked API.
