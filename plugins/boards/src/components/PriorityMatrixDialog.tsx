import { Button, Dialog, DialogBody, DialogHeader, Text } from '@backstage/ui';
import { BoardItem, BoardWithContext } from '@internal/plugin-boards-common';
import { ColorDot } from './StatusBadge';

/**
 * The status × priority matrix: one column per board column, one row per
 * priority (order 1 first) plus a trailing "No priority" row when items
 * without one exist. Cells hold the matching items; clicking one opens
 * its details.
 */
export function PriorityMatrixDialog(props: {
  board: BoardWithContext;
  /** The board's items, already narrowed by the active filters. */
  items: BoardItem[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onOpenItem: (itemId: string) => void;
}) {
  const { board, items, isOpen, onOpenChange, onOpenItem } = props;
  const priorities = [...board.priorities].sort((a, b) => a.order - b.order);
  const hasUnprioritized = items.some(item => !item.priorityId);
  const rows: Array<{
    key: string;
    label: React.ReactNode;
    matches: (item: BoardItem) => boolean;
  }> = [
    ...priorities.map(priority => ({
      key: priority.id,
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ColorDot color={priority.color} size={8} />
          {priority.name}
        </span>
      ),
      matches: (item: BoardItem) => item.priorityId === priority.id,
    })),
    ...(hasUnprioritized
      ? [
          {
            key: 'no-priority',
            label: <>No priority</>,
            matches: (item: BoardItem) => !item.priorityId,
          },
        ]
      : []),
  ];
  const cellStyle: React.CSSProperties = {
    border: '1px solid var(--bui-border-1)',
    padding: 8,
    verticalAlign: 'top',
    minWidth: 140,
  };
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width="90%">
      <DialogHeader>Priority matrix</DialogHeader>
      <DialogBody>
        <div style={{ overflowX: 'auto' }}>
          <table
            aria-label="Priority matrix"
            style={{ borderCollapse: 'collapse', width: '100%' }}
          >
            <thead>
              <tr>
                <th style={cellStyle} aria-label="Priority" />
                {board.columns.map(column => (
                  <th key={column.id} style={cellStyle} scope="col">
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <ColorDot color={column.color} size={8} />
                      <Text variant="body-small" weight="bold">
                        {column.title}
                      </Text>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}>
                  <th style={cellStyle} scope="row">
                    <Text variant="body-small" weight="bold">
                      {row.label}
                    </Text>
                  </th>
                  {board.columns.map(column => (
                    <td key={column.id} style={cellStyle}>
                      {items
                        .filter(
                          item =>
                            item.columnId === column.id && row.matches(item),
                        )
                        .map(item => (
                          <div key={item.id}>
                            <Button
                              variant="tertiary"
                              size="small"
                              onPress={() => onOpenItem(item.id)}
                              aria-label={`Open item ${item.title}`}
                            >
                              <Text variant="body-small">{item.title}</Text>
                            </Button>
                          </div>
                        ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogBody>
    </Dialog>
  );
}
