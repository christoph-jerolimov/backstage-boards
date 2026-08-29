import {
  boardsNewCreatePermission,
  boardsPermissions,
  boardsUsePermission,
} from './permissions';

describe('permissions', () => {
  it('defines boards.use as a basic permission without an action', () => {
    expect(boardsUsePermission.type).toBe('basic');
    expect(boardsUsePermission.name).toBe('boards.use');
    expect(boardsUsePermission.attributes.action).toBeUndefined();
  });

  it('defines boards.new.create as a create permission', () => {
    expect(boardsNewCreatePermission.type).toBe('basic');
    expect(boardsNewCreatePermission.name).toBe('boards.new.create');
    expect(boardsNewCreatePermission.attributes.action).toBe('create');
  });

  it('lists every plugin permission for registration', () => {
    expect(boardsPermissions).toEqual([
      boardsUsePermission,
      boardsNewCreatePermission,
    ]);
  });
});
