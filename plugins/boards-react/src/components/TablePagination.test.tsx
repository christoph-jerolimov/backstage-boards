import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './__testUtils__/testHelpers';
import { PageSize, TablePagination } from './TablePagination';

function renderFooter(
  over: Partial<Parameters<typeof TablePagination>[0]> = {},
) {
  const onOffsetChange = jest.fn();
  const onPageSizeChange = jest.fn();
  renderWithProviders(
    <TablePagination
      noun="boards"
      total={30}
      offset={0}
      count={25}
      pageSize={'25' as PageSize}
      onOffsetChange={onOffsetChange}
      onPageSizeChange={onPageSizeChange}
      {...over}
    />,
  );
  return { onOffsetChange, onPageSizeChange };
}

describe('TablePagination', () => {
  it('reports the range on screen out of the total', async () => {
    renderFooter();
    expect(await screen.findByText('1–25 of 30 boards')).toBeInTheDocument();
  });

  it('counts the rows on screen, not the page size, on the last page', async () => {
    renderFooter({ offset: 25, count: 5 });
    expect(await screen.findByText('26–30 of 30 boards')).toBeInTheDocument();
  });

  it('disables the step back on the first page', async () => {
    const { onOffsetChange } = renderFooter();
    expect(
      await screen.findByRole('button', { name: 'Previous' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(onOffsetChange).not.toHaveBeenCalled();
  });

  it('disables the step forward on the last page', async () => {
    renderFooter({ offset: 25, count: 5 });
    expect(await screen.findByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  it('steps by the page size', async () => {
    const { onOffsetChange } = renderFooter();
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(onOffsetChange).toHaveBeenCalledWith(25);
  });

  it('never steps back past the first row', async () => {
    const { onOffsetChange } = renderFooter({ offset: 10, count: 20 });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Previous' }),
    );
    expect(onOffsetChange).toHaveBeenCalledWith(0);
  });

  it('changes the page size', async () => {
    const { onPageSizeChange } = renderFooter();
    await userEvent.click(
      await screen.findByRole('button', { name: /Page size/ }),
    );
    await userEvent.click(
      await screen.findByRole('option', { name: '10 per page' }),
    );
    expect(onPageSizeChange).toHaveBeenCalledWith('10');
  });

  it('says so when there is nothing to page', async () => {
    renderFooter({ total: 0, count: 0 });
    expect(await screen.findByText('No boards')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
