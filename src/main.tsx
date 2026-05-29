import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SubmitPage } from './ui/SubmitPage';
import { AdminPage } from './ui/AdminPage';
import './index.css';

// Simple path-based routing (no library needed)
const path = window.location.pathname;
const isSubmitPage = path === '/submit' || path.startsWith('/submit/');
const isAdminPage = path === '/admin' || path.startsWith('/admin/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSubmitPage ? <SubmitPage /> : isAdminPage ? <AdminPage /> : <App />}
  </StrictMode>
);
