import { ReactNode } from 'react';
import { usePermission } from '@backstage/plugin-permission-react';
import {
  boardsNewCreatePermission,
  boardsUsePermission,
} from '@internal/plugin-boards-common';
import { Text } from '@backstage/ui';

/**
 * Whether the viewer holds the `boards.use` framework permission. Fails
 * open on a permission-api error: the frontend gates are UX only — the
 * backend enforces the decision — and failing open keeps the plugin fully
 * working when the permission framework is not in use.
 */
export function useBoardsUseAllowed(): { loading: boolean; allowed: boolean } {
  const { loading, allowed, error } = usePermission({
    permission: boardsUsePermission,
  });
  return { loading, allowed: allowed || error !== undefined };
}

/**
 * Whether the viewer may create (or duplicate) a board, per the
 * `boards.new.create` framework permission. Same fail-open rule as
 * {@link useBoardsUseAllowed}; while the decision loads, creation
 * affordances stay hidden rather than flickering in and out.
 */
export function useBoardsCreateAllowed(): boolean {
  const { loading, allowed, error } = usePermission({
    permission: boardsNewCreatePermission,
  });
  return !loading && (allowed || error !== undefined);
}

/**
 * Renders its children only for viewers granted `boards.use`; anyone else
 * sees the fallback (nothing, by default). Nothing is rendered while the
 * decision loads, so denied viewers never see board UI flash by.
 */
export function RequireBoardsUse(props: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { loading, allowed } = useBoardsUseAllowed();
  if (loading) {
    return null;
  }
  if (!allowed) {
    return <>{props.fallback ?? null}</>;
  }
  return <>{props.children}</>;
}

/** The access-restricted state the boards page and tab show when denied. */
export function BoardsAccessRestricted() {
  return <Text>You do not have access to boards.</Text>;
}
