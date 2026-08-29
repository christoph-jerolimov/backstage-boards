import {
  AuthService,
  BackstageCredentials,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import { NotAllowedError } from '@backstage/errors';
import {
  AuthorizeResult,
  BasicPermission,
} from '@backstage/plugin-permission-common';
import {
  boardsNewCreatePermission,
  boardsUsePermission,
} from '@internal/plugin-boards-common';

/**
 * The slice of the permissions service the guard needs, so tests can stand
 * in a plain object for it.
 */
export type BoardsPermissionsService = Pick<PermissionsService, 'authorize'>;

/**
 * Enforces the plugin-level framework permissions for every door into the
 * plugin (HTTP router, actions registry). Signed-in users are what the
 * framework can actually decide about, so only their credentials go to
 * `authorize`: service principals are short-circuited by the permissions
 * service itself (honoring their access restrictions), and anonymous
 * callers are exempt — the permission backend rejects tokenless authorize
 * requests outright, so their access stays governed by the share feature's
 * public visibilities, exactly as without the framework. With the
 * framework disabled every decision is ALLOW, keeping the integration
 * optional. Access within a board stays with the share feature; this
 * guard never looks at individual boards.
 */
export class BoardsPermissionGuard {
  constructor(
    private readonly options: {
      permissions: BoardsPermissionsService;
      auth: Pick<AuthService, 'isPrincipal'>;
    },
  ) {}

  /** Throws `NotAllowedError` unless `boards.use` is allowed. */
  async requireUse(credentials: BackstageCredentials): Promise<void> {
    await this.require(credentials, [boardsUsePermission]);
  }

  /**
   * Throws `NotAllowedError` unless both `boards.use` and
   * `boards.new.create` are allowed — creating a board implies using the
   * plugin, and batching keeps it one authorize round trip.
   */
  async requireCreate(credentials: BackstageCredentials): Promise<void> {
    await this.require(credentials, [
      boardsUsePermission,
      boardsNewCreatePermission,
    ]);
  }

  private async require(
    credentials: BackstageCredentials,
    permissions: BasicPermission[],
  ): Promise<void> {
    if (this.options.auth.isPrincipal(credentials, 'none')) {
      return;
    }
    const decisions = await this.options.permissions.authorize(
      permissions.map(permission => ({ permission })),
      { credentials },
    );
    const denied = decisions.findIndex(
      decision => decision.result !== AuthorizeResult.ALLOW,
    );
    if (denied >= 0) {
      throw new NotAllowedError(
        `The '${permissions[denied].name}' permission is not allowed for this user`,
      );
    }
  }
}
