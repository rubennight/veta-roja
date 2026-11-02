import './admin.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AdminApp } from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <BrowserRouter basename="/admin">
      <AdminApp />
    </BrowserRouter>,
  );
}
