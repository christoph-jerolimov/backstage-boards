import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { boardsQueryClient } from '../queries';
import { BoardListPage } from './BoardListPage';
import { BoardPage } from './BoardPage';
import { MyItemsPage } from './MyItemsPage';

export function BoardsPage() {
  return (
    <QueryClientProvider client={boardsQueryClient}>
      <Routes>
        <Route path="/" element={<BoardListPage />} />
        <Route path="my-items" element={<MyItemsPage />} />
        <Route path=":boardId" element={<BoardPage />} />
      </Routes>
    </QueryClientProvider>
  );
}
