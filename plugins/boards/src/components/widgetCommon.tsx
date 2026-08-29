import { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { boardsQueryClient } from '../queries';
import { RequireBoardsUse } from './RequireBoardsUse';

/**
 * Supplies the plugin's query client to a home page card. The boards
 * pages provide it themselves, but a card is rendered outside them.
 * Sharing the one client means a card and a boards page share a cache
 * entry for the same data, and two cards share one in-flight request.
 *
 * Both home page widgets render through here, so this is also where a
 * card goes quiet for viewers without the `boards.use` permission: the
 * widget content never mounts, so no boards API call is made either.
 */
export function BoardsWidgetProvider(props: { children?: ReactNode }) {
  return (
    <RequireBoardsUse>
      <QueryClientProvider client={boardsQueryClient}>
        {props.children}
      </QueryClientProvider>
    </RequireBoardsUse>
  );
}
