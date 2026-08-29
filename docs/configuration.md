# Configuration

This page is for admins and covers the boards-specific options. All of them
live in `app-config.yaml` (with production overrides in
`app-config.production.yaml`).

Standard Backstage concerns — the database, auth providers, and so on — are
configured exactly as documented by
[Backstage itself](https://backstage.io/docs/conf/) and are not repeated
here. One boards-specific note on identity: assignees, watchers, and share
grants are catalog entity refs, so the sign-in resolver must map the
signed-in user to a catalog user entity for the "my" features (My items,
the Assigned items card, reminders) to work.

## Scheduled reminders

Reminders are recurring notifications about a user's assigned items,
configured under `boards.reminders` (schema in
`plugins/boards-backend/config.d.ts`). None are configured by default. Each
entry runs as its own scheduled task; an entry without a valid `schedule`
fails startup with a clear error.

```yaml
boards:
  reminders:
    - id: overdue-weekday-mornings
      schedule:
        frequency: { cron: '0 8 * * 1-5' } # or e.g. { minutes: 10 }
        timeout: { minutes: 5 }
      scope: overdue
      grouping: per-board
      userFilter:
        metadata.namespace: default
      excludeUsers:
        metadata.labels.boards/notifications: 'false'
```

Options per reminder:

- **`id`** (required) — unique name of the reminder; also names its
  scheduled task.
- **`schedule`** (required) — a standard Backstage scheduler configuration:
  `frequency` as a cron expression (`{ cron: '0 8 * * 1-5' }`) or a human
  duration (`{ minutes: 10 }`, `{ hours: 1 }`, …), a `timeout` duration, an
  optional `initialDelay`, and an optional task `scope` (`global` runs it
  once across all backend instances, `local` on each).
- **`scope`** — which of a user's assigned items to include: `all`
  (default), `with-due-date`, `due-today`, or `overdue`.
- **`grouping`** — `combined` (default) sends each user one message across
  all boards; `per-board` sends one message per user per board.
- **`userFilter`** — catalog entity filter selecting the recipients, merged
  with `kind: User`; without it every user in the catalog is considered.
- **`excludeUsers`** — users whose entity matches any of these field/value
  pairs are skipped; the example above lets users opt out via a
  `boards/notifications: 'false'` label on their user entity.

For each recipient a run collects the items assigned to them directly or via
one of their groups, on readable, non-archived boards, excluding archived
items, then applies the configured scope; users with no matching items get
no message.

## The entity "Boards" tab

By default the tab appears only on entities that at least one board
references, via the `boards/is-referenced: "auto-detected"` label derived by
the catalog module. A deployment can replace that filter through the
extension's config, for instance to show the tab on every component:

```yaml
app:
  extensions:
    - entity-content:boards/entity:
        config:
          filter: { kind: component }
```

See [Catalog integration](features/catalog-entities.md) for how the label is
derived.

## Home page layout

The app's default home page layout places the two boards cards side by side;
every other widget stays available through the page's Edit mode. The layout
is plain new-frontend-system configuration on `page:home` — see the
`defaultConfig` block in `app-config.yaml` and
[Home page cards](features/home-page.md) for the cards' own settings.

## TechDocs

This documentation itself is served by TechDocs. The relevant pieces:

```yaml
techdocs:
  builder: 'local'
  generator:
    runIn: 'docker' # use 'local' if mkdocs & mkdocs-techdocs-core are installed
  publisher:
    type: 'local'
```

The root `catalog-info.yaml` carries the
`backstage.io/techdocs-ref: dir:.` annotation and is registered as a catalog
location, so the docs build from `mkdocs.yml` and the `docs/` folder of this
repository.
