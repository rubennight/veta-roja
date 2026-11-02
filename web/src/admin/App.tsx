import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api';
import { Login } from './pages/Login';
import { LandingList } from './pages/LandingList';
import { Settings } from './pages/Settings';

/** Deja pasar solo a quien tiene sesión; si no, manda a /login. */
function RequireAuth({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'in' | 'out'>('loading');
  useEffect(() => {
    let alive = true;
    api
      .me()
      .then(() => alive && setState('in'))
      .catch(() => alive && setState('out'));
    return () => {
      alive = false;
    };
  }, []);
  if (state === 'loading') return <p className="admin-loading">Cargando…</p>;
  if (state === 'out') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Layout() {
  const navigate = useNavigate();
  const logout = async () => {
    try {
      await api.logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };
  return (
    <div className="admin">
      <header className="admin-bar">
        <Link to="/" className="admin-brand">
          Veta Roja <span>· Panel</span>
        </Link>
        <nav>
          <NavLink to="/" end>
            Landings
          </NavLink>
          <NavLink to="/settings">Ajustes</NavLink>
        </nav>
        <button type="button" className="btn" onClick={logout}>
          Cerrar sesión
        </button>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

export function AdminApp() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<LandingList />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
