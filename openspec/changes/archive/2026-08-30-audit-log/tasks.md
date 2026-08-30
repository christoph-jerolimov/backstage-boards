## 1. Backend

- [x] 1.1 Add the audit middleware to `createRouter` (`audit` option),
      emit read/write events resolved by response status; verify with
      router tests for all three modes and a failing request.
- [x] 1.2 Wire `coreServices.auditor` and the validated `boards.audit`
      config in `plugin.ts` and extend `config.d.ts`; verify `tsc`
      and an invalid-value unit check.

## 2. Docs

- [x] 2.1 Document `boards.audit` in `docs/configuration.md` and the
      README; verify wording.
