# Permission framework

The plugin integrates with [Backstage's permission framework](https://backstage.io/docs/permissions/overview)
through two plugin-level permissions. Using the framework is **optional**:
with it disabled (`permission.enabled: false`) or with the default
allow-all policy, the plugin behaves exactly as if the integration did not
exist. Access _within_ a board is always governed by the plugin's own
[share feature](features/sharing.md) — the framework permissions sit above
it and never replace it.

## The permissions

Both are exported from `@internal/plugin-boards-common`:

| Permission          | Kind                    | Gates                                                                                                                                                                                             |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `boards.use`        | basic                   | The plugin as a whole — a feature flag per user. The boards page (and its sidebar item), the catalog **Boards** tab content, the home page cards, and **every** user-invoked API call and action. |
| `boards.new.create` | basic, `action: create` | Bringing a new board into existence: **Create board** and **Duplicate board…**, over REST and through the actions registry.                                                                       |

Denying `boards.new.create` lets an admin team own which boards exist while
everyone with `boards.use` keeps working inside the boards shared with
them. Service-to-service traffic (the catalog processor's entity-reference
lookup) and scheduled background jobs are not gated; service principals are
allowed by the framework itself, subject to their access restrictions.

Anonymous visitors are not evaluated — the permission framework cannot
authorize callers without a token — so `public-read`/`public-write` boards
remain reachable without a login regardless of the policy. The permissions
apply to signed-in users; anonymous access is governed by board visibility
alone, as it always was.

## Writing a policy

Replace the allow-all module in your backend with your own policy, for
example to reserve board creation for members of a group:

```ts
import {
  PolicyDecision,
  AuthorizeResult,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import { isPermission } from '@backstage/plugin-permission-common';
import { boardsNewCreatePermission } from '@internal/plugin-boards-common';

class BoardsPolicy implements PermissionPolicy {
  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    if (isPermission(request.permission, boardsNewCreatePermission)) {
      const isBoardAdmin = user?.info.ownershipEntityRefs.includes(
        'group:default/board-admins',
      );
      return {
        result: isBoardAdmin ? AuthorizeResult.ALLOW : AuthorizeResult.DENY,
      };
    }
    return { result: AuthorizeResult.ALLOW };
  }
}
```

See the [permission framework docs](https://backstage.io/docs/permissions/writing-a-policy)
for wiring a policy into your backend.

## What denied users see

- Without `boards.use`: no boards sidebar item, an access message instead
  of the boards page, quiet home page cards, and `403` on every boards API
  call. On entities that boards reference, the **Boards** tab shows an
  access message instead of board content (the tab itself is derived from
  an entity label, which permissions cannot influence).
- Without `boards.new.create`: no **Create board** button and no
  **Duplicate board…** menu entry; the API rejects create and duplicate
  with `403`. Everything else keeps working.

The frontend gates are a convenience; the backend enforces every decision
regardless of what the UI shows.
