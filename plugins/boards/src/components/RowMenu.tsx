import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { ButtonIcon, MenuTrigger } from '@backstage/ui';
import { RiMore2Fill } from '@remixicon/react';

export interface RowContextMenuState<T> {
  row: T;
  x: number;
  y: number;
}

/** Tracks which row was right-clicked and where, for `RowContextMenu`. */
export function useRowContextMenu<T>() {
  const [state, setState] = useState<RowContextMenuState<T> | undefined>();
  return {
    state,
    open: (row: T, event: MouseEvent) => {
      event.preventDefault();
      setState({ row, x: event.clientX, y: event.clientY });
    },
    close: () => setState(undefined),
  };
}

/**
 * The menu opened at the pointer position: a controlled MenuTrigger
 * anchored to an invisible 1×1 fixed-position button placed where the
 * user right-clicked, so the popover lands exactly there.
 */
export function RowContextMenu<T>(props: {
  state: RowContextMenuState<T> | undefined;
  onClose: () => void;
  label: (row: T) => string;
  children: (row: T) => ReactNode;
}) {
  const { state, onClose, label, children } = props;
  if (!state) {
    return null;
  }
  return (
    <MenuTrigger isOpen onOpenChange={open => !open && onClose()}>
      <ButtonIcon
        aria-label={label(state.row)}
        icon={<span />}
        style={{
          position: 'fixed',
          left: state.x,
          top: state.y,
          width: 1,
          height: 1,
          minWidth: 0,
          padding: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      {children(state.row)}
    </MenuTrigger>
  );
}

/**
 * Both ways into a row's menu: the three-dot button in its actions cell
 * and the right-click menu at the pointer. Every surface with row
 * actions needs the pair, and both must show the same menu.
 */
export interface RowMenuHandle<T> {
  /** Wire to a row's `onContextMenu`. */
  onContextMenu: (row: T, event: MouseEvent) => void;
  /** The contents of the row's actions cell. */
  rowActions: (row: T) => ReactNode;
  /** Mount once beside the rows. */
  contextMenu: ReactNode;
}

export function useRowMenu<T>(options: {
  /** Names the row in both menus' labels, e.g. the board or item title. */
  name: (row: T) => string;
  children: (row: T) => ReactNode;
}): RowMenuHandle<T> {
  const contextMenu = useRowContextMenu<T>();
  const { name, children } = options;
  return {
    onContextMenu: contextMenu.open,
    rowActions: (row: T) => (
      <RowActionsMenu label={`Actions for ${name(row)}`}>
        {children(row)}
      </RowActionsMenu>
    ),
    contextMenu: (
      <RowContextMenu
        state={contextMenu.state}
        onClose={contextMenu.close}
        label={row => `Context menu for ${name(row)}`}
      >
        {children}
      </RowContextMenu>
    ),
  };
}

/**
 * Fixes a utility column (favorite star, actions menu) to its icon
 * button's width. BUI tables use `table-layout: fixed`, so an explicit
 * small width is what shrinks the column — mirroring the library's own
 * 40px selection column, plus room for the cell padding.
 */
export const utilityColumnStyle = { width: 56 } as const;

/** Right-aligns an actions cell's control against the table edge. */
export function ActionsCellContent(props: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      {props.children}
    </div>
  );
}

/** The three-dot button for a table row's trailing actions cell. */
export function RowActionsMenu(props: { label: string; children: ReactNode }) {
  return (
    <MenuTrigger>
      <ButtonIcon
        aria-label={props.label}
        variant="tertiary"
        size="small"
        icon={<RiMore2Fill size={16} />}
      />
      {props.children}
    </MenuTrigger>
  );
}
