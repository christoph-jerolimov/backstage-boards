/**
 * Web library for the boards plugin: reusable UI building blocks built on
 * `@backstage/ui`, shareable across frontend plugins.
 *
 * @packageDocumentation
 */

export {
  selectedOption,
  RefLabel,
  RefDisplay,
  EntityRefList,
  ErrorText,
  AsyncList,
  InlineEdit,
  InlineAddField,
  formatDate,
} from './components/common';
export { MarkdownContent } from './components/MarkdownContent';
export { parseMarkdown } from './components/markdown';
export type { BlockToken, InlineToken } from './components/markdown';
export { CatalogRefPicker } from './components/CatalogRefPicker';
export { EntityPicker } from './components/EntityPicker';
export { PrincipalPicker } from './components/PrincipalPicker';
export {
  TablePagination,
  PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
} from './components/TablePagination';
export type { PageSize } from './components/TablePagination';
export { TagsEditor } from './components/TagsEditor';
export { ChecklistBadge, ChecklistEditor } from './components/ChecklistEditor';
export { EditableMarkdown } from './components/EditableMarkdown';
export { DueDateBadge, formatDueDate } from './components/DueDate';
export {
  colorHex,
  columnColorHex,
  ColorDot,
  ColumnDot,
  StatusChip,
  StatusBadge,
  PriorityChip,
} from './components/StatusBadge';
export { useAsyncAction } from './components/useAsyncAction';
export type { AsyncActionHandle } from './components/useAsyncAction';
