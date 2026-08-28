import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { BoardPriority } from '@internal/plugin-boards-common';
import { boardsApiRef, BoardsApi } from '../api';
import { BoardSettingsDialog } from './BoardSettingsDialog';
import {
  renderWithProviders,
  testBoard,
  testBoardsApi,
  testPriorities,
  testPriority,
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
  over: {
    entityRefs?: string[];
    priorities?: BoardPriority[];
    boardsApi?: jest.Mocked<BoardsApi>;
  } = {},
) {
  const boardsApi = over.boardsApi ?? testBoardsApi();
  const onChanged = jest.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <BoardSettingsDialog
      board={testBoard({
        entityRefs: over.entityRefs ?? ['component:default/www'],
        priorities: over.priorities ?? [],
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

  it('lists the priorities in order with their order numbers', () => {
    renderDialog({ priorities: testPriorities() });
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
  });

  it('says so when no priorities are defined', () => {
    renderDialog();
    expect(
      screen.getByText('No priorities defined; items cannot be prioritized.'),
    ).toBeInTheDocument();
  });

  it('adds a priority', async () => {
    const { boardsApi, onChanged } = renderDialog({
      priorities: testPriorities(),
    });
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New priority name' }),
      'blocker',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(boardsApi.addPriority).toHaveBeenCalledWith('board-1', {
      name: 'blocker',
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('disables adding at ten priorities', () => {
    const ten = Array.from({ length: 10 }, (_, index) =>
      testPriority({
        id: `priority-${index + 1}`,
        name: `p${index + 1}`,
        order: index + 1,
      }),
    );
    renderDialog({ priorities: ten });
    expect(
      screen.getByRole('textbox', { name: 'New priority name' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('renames a priority inline', async () => {
    const { boardsApi } = renderDialog({ priorities: testPriorities() });
    await userEvent.click(screen.getByText('high'));
    const field = await screen.findByRole('textbox', {
      name: 'priority high name',
    });
    await userEvent.clear(field);
    await userEvent.type(field, 'important{Enter}');
    expect(boardsApi.updatePriority).toHaveBeenCalledWith(
      'board-1',
      'priority-2',
      { name: 'important' },
    );
  });

  it('moves a priority up, renumbering by target order', async () => {
    const { boardsApi } = renderDialog({ priorities: testPriorities() });
    await userEvent.click(
      screen.getByRole('button', { name: 'Move priority high up' }),
    );
    expect(boardsApi.updatePriority).toHaveBeenCalledWith(
      'board-1',
      'priority-2',
      { order: 1 },
    );
    expect(
      screen.getByRole('button', { name: 'Move priority critical up' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Move priority low down' }),
    ).toBeDisabled();
  });

  it('sets and clears a priority color', async () => {
    const { boardsApi } = renderDialog({ priorities: testPriorities() });
    await userEvent.click(
      screen.getByRole('button', { name: 'Color of priority medium' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'purple' }),
    );
    expect(boardsApi.updatePriority).toHaveBeenCalledWith(
      'board-1',
      'priority-3',
      { color: 'purple' },
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Color of priority critical' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'No color' }),
    );
    expect(boardsApi.updatePriority).toHaveBeenCalledWith(
      'board-1',
      'priority-1',
      { color: null },
    );
  });

  it('deletes an unused priority directly', async () => {
    const { boardsApi } = renderDialog({ priorities: testPriorities() });
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete priority low' }),
    );
    expect(boardsApi.deletePriority).toHaveBeenCalledWith(
      'board-1',
      'priority-4',
    );
    expect(screen.queryByText(/still used by items/)).not.toBeInTheDocument();
  });

  it('offers reassign for a used priority and deletes with the target', async () => {
    const boardsApi = testBoardsApi({
      deletePriority: jest
        .fn()
        .mockRejectedValueOnce(
          new Error(
            'Priority is still used by items; choose to reassign or drop it',
          ),
        )
        .mockResolvedValue(undefined),
    });
    renderDialog({ priorities: testPriorities(), boardsApi });
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete priority high' }),
    );
    await screen.findByText(/“high” is still used by items/);
    await userEvent.click(
      screen.getByRole('button', { name: 'Reassign and delete' }),
    );
    expect(boardsApi.deletePriority).toHaveBeenLastCalledWith(
      'board-1',
      'priority-2',
      { reassignTo: 'priority-1' },
    );
  });

  it('drops a used priority from its items on request', async () => {
    const boardsApi = testBoardsApi({
      deletePriority: jest
        .fn()
        .mockRejectedValueOnce(
          new Error(
            'Priority is still used by items; choose to reassign or drop it',
          ),
        )
        .mockResolvedValue(undefined),
    });
    renderDialog({ priorities: testPriorities(), boardsApi });
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete priority low' }),
    );
    await screen.findByText(/“low” is still used by items/);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove priority from items and delete',
      }),
    );
    expect(boardsApi.deletePriority).toHaveBeenLastCalledWith(
      'board-1',
      'priority-4',
      { drop: true },
    );
  });
});
