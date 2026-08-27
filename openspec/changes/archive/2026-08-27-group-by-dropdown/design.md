# Design

`GroupByMode = 'none' | 'assignee' | 'dueDate' | 'tags'` and
`groupItems(items, mode)` in `grouping.ts`:
- assignee: existing multi-membership logic (unassigned last);
- dueDate: keyed by the `YYYY-MM-DD` value ascending, `no-due-date`
  sentinel group last;
- tags: one group per tag alphabetically, `untagged` sentinel last;
- none: single group (views skip headings).

`GroupLabel` (new small component) renders a group key per mode:
RefDisplay for assignees, relative/short date for due dates, plain text
for tags, and the sentinel labels. BoardPage replaces the Switch with a
compact `Select` and passes the mode down; the views' `groupBy` prop
changes from boolean to `GroupByMode`.
