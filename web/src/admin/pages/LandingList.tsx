import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MAX_GROUP_NAME, getTheme } from '@veta-roja/shared';
import { ApiError, api, type Group, type LandingSummary } from '../api';
import { EXIT_MS, prefersReducedMotion } from '../motion';

const ALL = '';
const NONE = '__none__';

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function LandingList() {
  const [items, setItems] = useState<LandingSummary[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState(ALL);
  const [themeFilter, setThemeFilter] = useState(ALL);
  const [newGroup, setNewGroup] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await api.listLandings());
    } catch {
      setError('No se pudo cargar la lista.');
    }
    // Los grupos son un extra: si fallan, la lista sigue funcionando sin ellos.
    try {
      setGroups(await api.listGroups());
    } catch {
      setGroups([]);
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

  const fail = (err: unknown, fallback: string) => setError(err instanceof ApiError && err.status === 409 ? err.message : fallback);

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    const name = newGroup.trim();
    if (!name) return;
    try {
      await api.createGroup(name);
      setNewGroup('');
      setError(null);
      await load();
    } catch (err) {
      fail(err, 'No se pudo crear el grupo.');
    }
  }

  async function renameGroup(group: Group) {
    const name = window.prompt('Nuevo nombre del grupo', group.name)?.trim();
    if (!name || name === group.name) return;
    try {
      await api.renameGroup(group.id, name);
      setError(null);
      await load();
    } catch (err) {
      fail(err, 'No se pudo renombrar el grupo.');
    }
  }

  async function removeGroup(group: Group) {
    const note = group.landingCount > 0 ? ` Sus ${group.landingCount} landings no se borran: quedan sin grupo.` : '';
    if (!window.confirm(`¿Eliminar el grupo "${group.name}"?${note}`)) return;
    try {
      await api.deleteGroup(group.id);
      if (groupFilter === group.id) setGroupFilter(ALL);
      setError(null);
      await load();
    } catch {
      setError('No se pudo eliminar el grupo.');
    }
  }

  async function moveToGroup(item: LandingSummary, groupId: string) {
    try {
      const l = await api.getLanding(item.id);
      await api.updateLanding(item.id, {
        title: l.title,
        description: l.description,
        slug: l.slug,
        themeId: l.themeId,
        status: l.status,
        slides: l.slides,
        ctaUrl: l.ctaUrl,
        groupId: groupId === '' ? null : groupId,
      });
      setError(null);
      await load();
    } catch {
      setError('No se pudo cambiar el grupo.');
    }
  }

  const usedThemes = useMemo(() => [...new Set((items ?? []).map((i) => i.themeId))], [items]);
  const filtering = query.trim() !== '' || groupFilter !== ALL || themeFilter !== ALL;

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return (items ?? []).filter((item) => {
      if (q && !normalize(item.title).includes(q) && !normalize(item.slug).includes(q)) return false;
      if (groupFilter === NONE ? item.groupId !== null : groupFilter !== ALL && item.groupId !== groupFilter) return false;
      if (themeFilter !== ALL && item.themeId !== themeFilter) return false;
      return true;
    });
  }, [items, query, groupFilter, themeFilter]);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  // Un groupId que ya no existe (carrera con otro borrado) se trata como "sin grupo".
  const sections = useMemo(() => {
    const byGroup = groups.map((group) => ({ group, rows: visible.filter((i) => i.groupId === group.id) }));
    const loose = visible.filter((i) => i.groupId === null || !groupById.has(i.groupId));
    return { byGroup, loose };
  }, [groups, groupById, visible]);

  function clearFilters() {
    setQuery('');
    setGroupFilter(ALL);
    setThemeFilter(ALL);
  }

  function rowsTable(rows: LandingSummary[]) {
    return (
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Estado</th>
              <th>Theme</th>
              <th>Dirección</th>
              <th>Actualizada</th>
              {groups.length > 0 && <th>Grupo</th>}
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
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
                {groups.length > 0 && (
                  <td>
                    <select
                      className="row-group"
                      aria-label={`Grupo de ${item.title}`}
                      value={item.groupId && groupById.has(item.groupId) ? item.groupId : ''}
                      onChange={(e) => void moveToGroup(item, e.target.value)}
                    >
                      <option value="">Sin grupo</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
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
    );
  }

  const hasGroups = groups.length > 0;
  const nothingMatches = items !== null && items.length > 0 && visible.length === 0;

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
        <>
          <div className="list-tools">
            <div className="field">
              <label htmlFor="list-search">Buscar</label>
              <input id="list-search" type="search" value={query} placeholder="Título o dirección" onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="list-group">Grupo</label>
              <select id="list-group" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                <option value={ALL}>Todos</option>
                <option value={NONE}>Sin grupo</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="list-theme">Theme</label>
              <select id="list-theme" value={themeFilter} onChange={(e) => setThemeFilter(e.target.value)}>
                <option value={ALL}>Todos</option>
                {usedThemes.map((id) => (
                  <option key={id} value={id}>
                    {getTheme(id)?.name ?? id}
                  </option>
                ))}
              </select>
            </div>
            {filtering && (
              <button type="button" className="btn" onClick={clearFilters}>
                Limpiar filtros
              </button>
            )}
          </div>
          <form className="group-new" onSubmit={createGroup}>
            <div className="field">
              <label htmlFor="group-new">Nombre del grupo nuevo</label>
              <input id="group-new" value={newGroup} maxLength={MAX_GROUP_NAME} placeholder="Por ejemplo: Taller de febrero" onChange={(e) => setNewGroup(e.target.value)} />
            </div>
            <button type="submit" className="btn" disabled={newGroup.trim() === ''}>
              Crear grupo
            </button>
          </form>
        </>
      )}

      {nothingMatches && (
        <div className="admin-empty">
          <p>Ninguna landing coincide con la búsqueda.</p>
        </div>
      )}

      {items && visible.length > 0 && !hasGroups && rowsTable(visible)}

      {items && hasGroups && !nothingMatches && (
        <>
          {sections.byGroup.map(({ group, rows }) => {
            // Con filtros activos solo se muestran los grupos con coincidencias; sin ellos, también los vacíos (para poder borrarlos).
            if (filtering && rows.length === 0) return null;
            return (
              <section key={group.id} className="group-section" aria-labelledby={`g-${group.id}`}>
                <details open>
                  <summary>
                    <h2 id={`g-${group.id}`}>
                      {group.name} <span className="group-count">({rows.length})</span>
                    </h2>
                  </summary>
                  <div className="group-actions">
                    <button type="button" className="btn" onClick={() => renameGroup(group)}>
                      Renombrar grupo
                    </button>
                    <button type="button" className="btn danger" onClick={() => removeGroup(group)}>
                      Eliminar grupo
                    </button>
                  </div>
                  {rows.length > 0 ? rowsTable(rows) : <p className="group-empty">Sin landings. Mueve alguna aquí desde la columna Grupo.</p>}
                </details>
              </section>
            );
          })}
          {sections.loose.length > 0 && (
            <section className="group-section" aria-labelledby="g-none">
              <details open>
                <summary>
                  <h2 id="g-none">
                    Sin grupo <span className="group-count">({sections.loose.length})</span>
                  </h2>
                </summary>
                {rowsTable(sections.loose)}
              </details>
            </section>
          )}
        </>
      )}
    </section>
  );
}
