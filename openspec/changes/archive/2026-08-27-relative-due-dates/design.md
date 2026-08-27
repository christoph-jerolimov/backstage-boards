# Design

`relativeDueLabel(dueDate, now?)` compares the due date against local
yesterday/today/tomorrow ISO strings and returns the label or undefined.
`DueDateBadge` prefers the relative label ("Due yesterday/today/
tomorrow"); otherwise it keeps the existing "Overdue <date>" /
"Due <date>" wording. Colors continue to come from `dueState`.
