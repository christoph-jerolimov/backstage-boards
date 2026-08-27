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
