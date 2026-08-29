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
  principal: { type: 'user', userEntityRef: 'user:default/alice' },
} as unknown as BackstageCredentials;

const anonymousCredentials = {
  $$type: '@backstage/BackstageCredentials',
  principal: { type: 'none' },
} as unknown as BackstageCredentials;

function guardDeciding(decisions: Record<string, AuthorizeResult>) {
  const authorize = jest.fn(async (requests: Array<{ permission: any }>) =>
    requests.map(({ permission }) => ({
      result: decisions[permission.name] ?? AuthorizeResult.DENY,
    })),
  );
  const guard = new BoardsPermissionGuard({
    permissions: { authorize } as any,
    auth: {
      isPrincipal: ((creds: BackstageCredentials, type: string) =>
        (creds.principal as { type?: string })?.type === type) as any,
    },
  });
  return { guard, authorize };
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

  it('exempts anonymous credentials from both checks', async () => {
    // the permission backend rejects tokenless authorize calls, so
    // anonymous access stays governed by the share feature's visibilities
    const { guard, authorize } = guardDeciding({});
    await expect(
      guard.requireUse(anonymousCredentials),
    ).resolves.toBeUndefined();
    await expect(
      guard.requireCreate(anonymousCredentials),
    ).resolves.toBeUndefined();
    expect(authorize).not.toHaveBeenCalled();
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
