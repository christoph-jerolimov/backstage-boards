import { createPermission } from '@backstage/plugin-permission-common';

/**
 * Gates the boards plugin as a whole: the boards page, the catalog tab, the
 * home page widgets, and every user-invoked API call are only available when
 * a policy allows this permission. Basic (no action attribute) — it is a
 * capability flag, not a CRUD verb. Access within a board stays governed by
 * the board's own share settings.
 *
 * @public
 */
export const boardsUsePermission = createPermission({
  name: 'boards.use',
  attributes: {},
});

/**
 * Gates bringing a new board into existence (create and duplicate), so an
 * installation can choose between admin-managed boards and open creation.
 *
 * @public
 */
export const boardsNewCreatePermission = createPermission({
  name: 'boards.new.create',
  attributes: { action: 'create' },
});

/**
 * All permissions the boards plugin registers with the permission framework.
 *
 * @public
 */
export const boardsPermissions = [
  boardsUsePermission,
  boardsNewCreatePermission,
];
