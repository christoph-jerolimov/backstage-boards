import { BackstageCredentials } from '@backstage/backend-plugin-api';
import { NotAllowedError } from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  boardsNewCreatePermission,
  boardsUsePermission,
} from '@internal/plugin-boards-common';
import { BoardsPermissionGuard } from './permissions';

const credentials = {
  $$type: '@backstage/BackstageCredentials',
  principal: { userEntityRef: 'user:default/alice' },
} as unknown as BackstageCredentials;

function guardDeciding(decisions: Record<string, AuthorizeResult>) {
  const authorize = jest.fn(async (requests: Array<{ permission: any }>) =>
    requests.map(({ permission }) => ({
      result: decisions[permission.name] ?? AuthorizeResult.DENY,
    })),
  );
  return { guard: new BoardsPermissionGuard({ authorize } as any), authorize };
}

describe('BoardsPermissionGuard', () => {
  it('passes requireUse through on ALLOW', async () => {
    const { guard, authorize } = guardDeciding({
      'boards.use': AuthorizeResult.ALLOW,
    });
    await expect(guard.requireUse(credentials)).resolves.toBeUndefined();
    expect(authorize).toHaveBeenCalledWith(
      [{ permission: boardsUsePermission }],
      { credentials },
    );
  });

  it('rejects requireUse on DENY', async () => {
    const { guard } = guardDeciding({ 'boards.use': AuthorizeResult.DENY });
    await expect(guard.requireUse(credentials)).rejects.toThrow(
      NotAllowedError,
    );
  });

  it('authorizes use and create together for requireCreate', async () => {
    const { guard, authorize } = guardDeciding({
      'boards.use': AuthorizeResult.ALLOW,
      'boards.new.create': AuthorizeResult.ALLOW,
    });
    await expect(guard.requireCreate(credentials)).resolves.toBeUndefined();
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledWith(
      [
        { permission: boardsUsePermission },
        { permission: boardsNewCreatePermission },
      ],
      { credentials },
    );
  });

  it('rejects requireCreate when only use is allowed', async () => {
    const { guard } = guardDeciding({
      'boards.use': AuthorizeResult.ALLOW,
      'boards.new.create': AuthorizeResult.DENY,
    });
    await expect(guard.requireCreate(credentials)).rejects.toThrow(
      /boards\.new\.create/,
    );
  });

  it('rejects requireCreate when use itself is denied', async () => {
    const { guard } = guardDeciding({
      'boards.new.create': AuthorizeResult.ALLOW,
    });
    await expect(guard.requireCreate(credentials)).rejects.toThrow(
      /boards\.use/,
    );
  });
});
