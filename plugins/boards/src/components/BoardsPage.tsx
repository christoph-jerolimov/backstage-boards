import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { boardsQueryClient } from '../queries';
import { BoardListPage } from './BoardListPage';
import { BoardPage } from './BoardPage';

export function BoardsPage() {
  return (
    <QueryClientProvider client={boardsQueryClient}>
      <Routes>
        <Route path="/" element={<BoardListPage />} />
        <Route path=":boardId" element={<BoardPage />} />
      </Routes>
    </QueryClientProvider>
  );
}
