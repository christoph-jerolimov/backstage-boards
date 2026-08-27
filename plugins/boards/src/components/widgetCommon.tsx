import { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { boardsQueryClient } from '../queries';

/**
 * Supplies the plugin's query client to a home page card. The boards
 * pages provide it themselves, but a card is rendered outside them.
 * Sharing the one client means a card and a boards page share a cache
 * entry for the same data, and two cards share one in-flight request.
 */
export function BoardsWidgetProvider(props: { children?: ReactNode }) {
  return (
    <QueryClientProvider client={boardsQueryClient}>
      {props.children}
    </QueryClientProvider>
  );
}
