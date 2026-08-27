import { Route, Routes } from 'react-router-dom';
import { BoardListPage } from './BoardListPage';
import { BoardPage } from './BoardPage';

export function BoardsPage() {
  return (
    <Routes>
      <Route path="/" element={<BoardListPage />} />
      <Route path=":boardId" element={<BoardPage />} />
    </Routes>
  );
}
