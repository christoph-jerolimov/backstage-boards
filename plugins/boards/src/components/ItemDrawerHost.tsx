import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BoardItem, levelIncludes } from '@internal/plugin-boards-common';
import {
  invalidateBoard,
  invalidateMyItems,
  useBoardQuery,
  useItemsQuery,
} from '../queries';
import { useBoardsBasePath } from '../routes';
import { ItemDrawer } from './ItemDrawer';

/**
 * Hosts the item drawer outside the board page — on the my-items listing
 * and the home page card — so an item can be inspected and edited in
 * place. Holds only ids plus the listing's snapshot, so the drawer stays
 * open even when an edit removes its row from the hosting list.
 */
export function ItemDrawerHost(props: {
  boardId: string;
  itemId: string;
  /** The listing's snapshot, shown until the board's own items arrive. */
  fallbackItem: BoardItem;
  onClose: () => void;
}) {
  const { boardId, itemId, fallbackItem, onClose } = props;
  const navigate = useNavigate();
  const basePath = useBoardsBasePath();
  const queryClient = useQueryClient();

  const { data: board, isError } = useBoardQuery(boardId);
  const { data: items } = useItemsQuery(boardId);

  // The board page owns error rendering: a board that cannot be loaded
  // in place (deleted, access revoked) falls back to navigating there.
  useEffect(() => {
    if (isError) {
      navigate(`${basePath}/${boardId}?item=${itemId}`);
    }
  }, [isError, navigate, basePath, boardId, itemId]);

  const item = items?.find(i => i.id === itemId) ?? fallbackItem;
  const tagSuggestions = useMemo(
    () => [...new Set((items ?? []).flatMap(i => i.tags))].sort(),
    [items],
  );

  if (!board) {
    return null;
  }
  const canWrite = levelIncludes(board.access, 'write') && !board.archivedAt;
  // A portal, because a host may sit inside a transformed ancestor (the
  // home page grid positions its cells with CSS transforms), which would
  // trap the drawer's fixed positioning inside that cell.
  return createPortal(
    <ItemDrawer
      board={board}
      item={item}
      canWrite={canWrite}
      tagSuggestions={tagSuggestions}
      onClose={onClose}
      onChanged={async () => {
        await invalidateBoard(queryClient, boardId);
        await invalidateMyItems(queryClient);
      }}
    />,
    document.body,
  );
}
