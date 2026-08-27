# @internal/plugin-boards

Frontend for the boards plugin, built exclusively on the Backstage new
frontend system. Provides:

- `/boards` — list of favorited and all accessible boards
- `/boards/:boardId` — kanban board view and table view with
  group-by-assignee, inline editing, drag & drop (with an accessible
  "Move to column" menu fallback), and an item detail drawer with a unified
  comments + change history timeline
- a share dialog for user/group permissions and public visibility modes
- a "Boards" tab on catalog entities listing the boards assigned to them

UI is composed from Backstage UI components with react-aria used where no
Backstage UI component exists (drag & drop, the drawer overlay).
