import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { boardsQueryClient } from '../queries';
import { BoardListPage } from './BoardListPage';
import { BoardPage } from './BoardPage';
import { MyItemsPage } from './MyItemsPage';
import { BoardsAccessRestricted, RequireBoardsUse } from './RequireBoardsUse';

export function BoardsPage() {
  return (
    // Opening a boards URL without the `boards.use` permission shows the
    // access-restricted state instead of board content; the backend rejects
    // the API calls regardless.
    <RequireBoardsUse fallback={<BoardsAccessRestricted />}>
      <QueryClientProvider client={boardsQueryClient}>
        <Routes>
          <Route path="/" element={<BoardListPage />} />
          <Route path="my-items" element={<MyItemsPage />} />
          <Route path=":boardId" element={<BoardPage />} />
        </Routes>
      </QueryClientProvider>
    </RequireBoardsUse>
  );
}
