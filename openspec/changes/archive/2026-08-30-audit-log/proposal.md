## Why

Organizations often must be able to answer "who changed what, when" —
and sometimes "who looked at what". The backend records item history
for the UI, but there is no operational audit trail, and none of it is
configurable.

## What Changes

- The boards backend can emit audit events through Backstage's core
  **auditor service** for its HTTP API, controlled by a new app-config
  setting `boards.audit`:
  - `none` (default) — no audit events, today's behavior;
  - `writes` — every mutating request (POST/PUT/PATCH/DELETE) is
    audited;
  - `all` — read requests (GET) are audited too.
- Each event carries the request (the auditor attaches the actor), the
  method and path, and resolves to success or failure with the HTTP
  status; failures include the error.
- Configuration is documented in the config schema and the docs.

## Capabilities

### New Capabilities

- `boards/audit-log`: configurable audit logging of the boards API
  through the core auditor service.

### Modified Capabilities

None.

## Impact

- `plugins/boards-backend` — audit middleware in the router, auditor
  dependency in the plugin, `config.d.ts` entry.
- Docs: `docs/configuration.md` and README.
