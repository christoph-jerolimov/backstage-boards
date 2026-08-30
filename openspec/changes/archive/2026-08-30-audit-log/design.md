## Context

Backstage's backend system ships a core `auditor` service
(`coreServices.auditor`): `createEvent({eventId, request, meta})`
returns an event resolved with `success()` or `fail()`, and the
auditor derives the actor from the request's credentials. The boards
router is a plain express router assembled in `createRouter`; the
plugin wires core services in `plugin.ts`, and `config.d.ts` carries
the config schema.

## Goals / Non-Goals

**Goals:**
- Zero-cost default (`none`), one config knob, correct actor
  attribution via the auditor.

**Non-Goals:**
- No own audit storage or read API — where events land (log, external
  sink) is the auditor backend's concern.
- No per-operation event taxonomy beyond read/write; the method+path
  meta identifies the operation.

## Decisions

- **Middleware, not per-handler calls**: one `router.use` before the
  routes creates the event (eventId `read` or `write`, the request,
  `{method, path}` meta) and resolves it on the response's `finish`
  (status < 400 → success, otherwise fail with the status). This
  covers every current and future route uniformly.
- **Config** `boards.audit: 'none' | 'writes' | 'all'`, validated in
  `plugin.ts` with an explicit throw on unknown values (silent
  no-audit would be a compliance hazard).
- `createRouter` takes an optional `audit: { mode, auditor }`; tests
  inject a recording fake.

## Risks / Trade-offs

- Auditing at the HTTP layer logs attempts as failures too (e.g. 403),
  which is what an audit trail wants; bodies are not logged, so no
  content leaks into logs.
