import { render, screen } from '@testing-library/react';
import { todayISO, tomorrowISO } from '@internal/plugin-boards-common';
import { DueDateBadge, formatDueDate } from './DueDate';

describe('formatDueDate', () => {
  it('formats a date in the current year without the year', () => {
    const year = new Date().getFullYear();
    expect(formatDueDate(`${year}-08-29`)).toBe('Aug 29');
  });

  it('includes the year for other years', () => {
    expect(formatDueDate('2030-01-05')).toContain('2030');
  });
});

describe('DueDateBadge', () => {
  it('renders nothing without a due date', () => {
    const { container } = render(<DueDateBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks a due-today item with the warning color', () => {
    render(<DueDateBadge dueDate={todayISO()} />);
    const badge = screen.getByText('Due today');
    expect(badge).toHaveAttribute('data-due-state', 'today');
    expect(badge).toHaveStyle({ color: 'var(--bui-fg-warning)' });
  });

  it('marks an overdue item with the error color', () => {
    render(<DueDateBadge dueDate="2020-01-02" />);
    const badge = screen.getByText('Overdue Jan 2, 2020');
    expect(badge).toHaveAttribute('data-due-state', 'overdue');
    expect(badge).toHaveStyle({ color: 'var(--bui-fg-negative)' });
  });

  it('uses relative wording for yesterday and tomorrow', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    render(<DueDateBadge dueDate={todayISO(yesterday)} />);
    expect(screen.getByText('Due yesterday')).toHaveAttribute(
      'data-due-state',
      'overdue',
    );

    render(<DueDateBadge dueDate={tomorrowISO()} />);
    expect(screen.getByText('Due tomorrow')).toHaveAttribute(
      'data-due-state',
      'upcoming',
    );
  });

  it('renders far-out dates absolutely without an urgency color', () => {
    render(<DueDateBadge dueDate="2999-12-31" />);
    const badge = screen.getByText('Due Dec 31, 2999');
    expect(badge).toHaveAttribute('data-due-state', 'upcoming');
    expect(badge).not.toHaveStyle({ color: 'var(--bui-fg-negative)' });
  });
});
