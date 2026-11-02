import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTheme } from '@veta-roja/shared';
import { api, type LandingSummary } from '../api';
import { EXIT_MS, prefersReducedMotion } from '../motion';

export function LandingList() {
  const [items, setItems] = useState<LandingSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.listLandings());
    } catch {
      setError('No se pudo cargar la lista.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function remove(item: LandingSummary) {
    if (!window.confirm(`¿Eliminar la landing "${item.title}"? Su QR dejará de funcionar y no se puede deshacer.`)) return;
    try {
      await api.deleteLanding(item.id);
      if (!prefersReducedMotion()) {
        setLeavingId(item.id);
        await new Promise((resolve) => setTimeout(resolve, EXIT_MS));
      }
      await load();
      setLeavingId(null);
    } catch {
      setError('No se pudo eliminar la landing.');
    }
  }

  return (
    <section>
      <div className="admin-head">
        <h1>Landings</h1>
        <Link to="/landings/new" className="btn solid">
          Nueva landing
        </Link>
      </div>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {items === null && !error && <p className="admin-loading">Cargando…</p>}
      {items && items.length === 0 && (
        <div className="admin-empty">
          <p>Todavía no hay landings.</p>
          <Link to="/landings/new" className="btn">
            Crear la primera: nueva landing
          </Link>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Estado</th>
                <th>Theme</th>
                <th>Dirección</th>
                <th>Actualizada</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={leavingId === item.id ? 'is-leaving' : undefined}>
                  <td>{item.title}</td>
                  <td>
                    <span className={`pill ${item.status}`}>{item.status === 'published' ? 'Publicada' : 'Borrador'}</span>
                  </td>
                  <td>{getTheme(item.themeId)?.name ?? item.themeId}</td>
                  <td>
                    <a href={`/l/${item.slug}`} target="_blank" rel="noopener noreferrer">{`/l/${item.slug}`}</a>
                  </td>
                  <td>{new Date(item.updatedAt).toLocaleDateString('es-MX')}</td>
                  <td className="actions">
                    <Link to={`/landings/${item.id}`} className="btn">
                      Editar
                    </Link>
                    <button type="button" className="btn danger" onClick={() => remove(item)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
