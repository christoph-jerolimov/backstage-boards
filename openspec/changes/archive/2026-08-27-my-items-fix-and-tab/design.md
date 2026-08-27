# Design

The backend matching was correct (verified by API); the mismatch is the
sign-in identity. `auth.providers.guest.userEntityRef` points the guest
session at the catalog user so assignee refs align. The listing logic
gains regression tests at the router level (`GET /my-items` returns the
caller's direct and group assignments, not others'). `MyItemsPage`
splits into `MyItemsList` (fetch + render, reused by the new tab on the
board list page) and the standalone page wrapper with heading and
breadcrumb.
