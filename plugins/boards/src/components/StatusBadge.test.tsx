import { render, screen } from '@testing-library/react';
import { BoardColumn, COLUMN_COLORS } from '@internal/plugin-boards-common';
import { ColumnDot, columnColorHex, StatusBadge } from './StatusBadge';

const column = (over: Partial<BoardColumn> = {}): BoardColumn => ({
  id: 'c1',
  boardId: 'b1',
  title: 'Todo',
  position: 1000,
  ...over,
});

describe('columnColorHex', () => {
  it('maps a named color and falls back to neutral', () => {
    expect(columnColorHex(column({ color: 'green' }))).toBe(
      COLUMN_COLORS.green,
    );
    expect(columnColorHex(column())).toBe('#8a8f98');
    expect(columnColorHex(undefined)).toBe('#8a8f98');
  });
});

describe('ColumnDot', () => {
  it('renders a decorative dot in the column color at the given size', () => {
    const { container } = render(
      <ColumnDot column={column({ color: 'red' })} size={14} />,
    );
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveAttribute('aria-hidden');
    expect(dot).toHaveStyle({
      width: '14px',
      height: '14px',
      background: COLUMN_COLORS.red,
    });
  });
});

describe('StatusBadge', () => {
  it('shows the column title', () => {
    render(<StatusBadge column={column({ title: 'In progress' })} />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('shows a placeholder for an unknown column', () => {
    render(<StatusBadge />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
