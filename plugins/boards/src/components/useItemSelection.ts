import { useMemo, useState } from 'react';

/**
 * The shared item-id selection the board page keeps for bulk actions:
 * the table's checkboxes, the board cards' selected marking, and the
 * keyboard's Space toggle all render and edit the same handle.
 */
export interface SelectionHandle {
  selected: ReadonlySet<string>;
  toggleItem: (itemId: string) => void;
  setMany: (itemIds: string[], on: boolean) => void;
  clear: () => void;
}

/**
 * Selection is a set of item ids: grouping only re-partitions the same
 * items, so it survives a group-by change (and a board/table view
 * switch), and an item shown in several groups is one selection; ids of
 * vanished items simply stop matching.
 */
export function useItemSelection(): SelectionHandle {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  return useMemo(
    () => ({
      selected,
      toggleItem: itemId =>
        setSelected(current => {
          const next = new Set(current);
          if (!next.delete(itemId)) {
            next.add(itemId);
          }
          return next;
        }),
      setMany: (itemIds, on) =>
        setSelected(current => {
          const next = new Set(current);
          for (const itemId of itemIds) {
            if (on) {
              next.add(itemId);
            } else {
              next.delete(itemId);
            }
          }
          return next;
        }),
      clear: () => setSelected(new Set()),
    }),
    [selected],
  );
}
