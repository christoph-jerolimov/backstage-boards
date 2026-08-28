import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { boardsApiRef, BoardsApi } from '../api';
import { BoardSettingsDialog } from './BoardSettingsDialog';
import {
  renderWithProviders,
  testBoard,
  testBoardsApi,
} from './__testUtils__/testHelpers';

const catalogApi = {
  getEntities: jest.fn().mockResolvedValue({
    items: [
      { kind: 'Component', metadata: { namespace: 'default', name: 'api' } },
      { kind: 'Component', metadata: { namespace: 'default', name: 'www' } },
    ],
  }),
  getEntitiesByRefs: jest.fn().mockResolvedValue({ items: [] }),
};

function renderDialog(
  over: { entityRefs?: string[]; boardsApi?: jest.Mocked<BoardsApi> } = {},
) {
  const boardsApi = over.boardsApi ?? testBoardsApi();
  const onChanged = jest.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <BoardSettingsDialog
      board={testBoard({
        entityRefs: over.entityRefs ?? ['component:default/www'],
      })}
      isOpen
      onOpenChange={jest.fn()}
      onChanged={onChanged}
    />,
    {
      apis: [
        [boardsApiRef, boardsApi],
        [catalogApiRef, catalogApi],
      ],
    },
  );
  return { boardsApi, onChanged };
}

describe('BoardSettingsDialog', () => {
  it('lists the referenced entities', async () => {
    renderDialog();
    expect(screen.getByText('Board settings')).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'www' }),
    ).toBeInTheDocument();
  });

  it('says so when no entity is referenced', () => {
    renderDialog({ entityRefs: [] });
    expect(screen.getByText('No entities referenced yet.')).toBeInTheDocument();
  });

  it('removes a reference and refreshes the board', async () => {
    const { boardsApi, onChanged } = renderDialog({
      entityRefs: ['component:default/www', 'component:default/api'],
    });
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove entity component:default/www',
      }),
    );
    expect(boardsApi.updateBoard).toHaveBeenCalledWith('board-1', {
      entityRefs: ['component:default/api'],
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('adds a reference picked from the catalog', async () => {
    const { boardsApi } = renderDialog({ entityRefs: [] });
    await userEvent.type(
      screen.getByRole('combobox', { name: 'Add entity reference' }),
      'api',
    );
    await userEvent.click(await screen.findByRole('option'));
    expect(boardsApi.updateBoard).toHaveBeenCalledWith('board-1', {
      entityRefs: ['component:default/api'],
    });
  });

  it('shows why saving failed', async () => {
    const boardsApi = testBoardsApi({
      updateBoard: jest.fn().mockRejectedValue(new Error('Not allowed')),
    });
    renderDialog({ boardsApi });
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove entity component:default/www',
      }),
    );
    expect(await screen.findByText('Not allowed')).toBeInTheDocument();
  });
});
