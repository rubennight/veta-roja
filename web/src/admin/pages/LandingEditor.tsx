import { useEffect, useReducer, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LandingInputSchema, THEMES, normalizeSlug } from '@veta-roja/shared';
import type { ZodIssue } from 'zod';
import { ApiError, api } from '../api';
import { editorReducer, emptyState, stateFromLanding, toInput } from '../editorState';
import { SelectField, TextField } from '../components/fields';
import { SlideList } from '../components/SlideList';
import { LivePreview } from '../components/LivePreview';
import { QrPanel } from '../components/QrPanel';

const FIELD_NAMES: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  slug: 'Dirección',
  themeId: 'Theme',
  ctaUrl: 'Enlace del botón',
};

function describeIssue(issue: ZodIssue): string {
  const [first, index, ...rest] = issue.path;
  const where =
    first === 'slides' && typeof index === 'number'
      ? `Diapositiva ${index + 1}${rest.length ? ` (${rest.join(' › ')})` : ''}`
      : FIELD_NAMES[String(first)] ?? String(first ?? 'Datos');
  const empty = issue.code === 'too_small' && 'origin' in issue && issue.origin === 'string';
  const what = empty ? 'es obligatorio' : issue.code === 'too_big' ? 'es demasiado largo' : issue.message;
  return `${where}: ${what}`;
}

export function LandingEditor() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(editorReducer, undefined, emptyState);
  const [landingId, setLandingId] = useState<string | null>(params.id && params.id !== 'new' ? params.id : null);
  const [loaded, setLoaded] = useState(params.id === 'new');
  const [defaultCtaUrl, setDefaultCtaUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Lo que hay guardado en el servidor: de ahí sale el QR (no de lo que se está escribiendo).
  const [persisted, setPersisted] = useState<{ slug: string; status: 'draft' | 'published' } | null>(null);

  // Carga la landing existente (no al crear una nueva ni justo después de guardarla por primera vez).
  useEffect(() => {
    if (!params.id || params.id === 'new' || loaded) return;
    let alive = true;
    api
      .getLanding(params.id)
      .then((l) => {
        if (!alive) return;
        dispatch({ type: 'load', state: stateFromLanding(l) });
        setLandingId(l.id);
        setPersisted({ slug: l.slug, status: l.status });
        setLoaded(true);
      })
      .catch(() => alive && setErrors(['No se pudo cargar la landing.']));
    return () => {
      alive = false;
    };
  }, [params.id, loaded]);

  useEffect(() => {
    api
      .getDefaultCtaUrl()
      .then((r) => setDefaultCtaUrl(r.url))
      .catch(() => setDefaultCtaUrl(null));
  }, []);

  // Cualquier cambio quita el "Guardado" anterior.
  useEffect(() => setSaved(false), [state]);

  async function save() {
    setSaved(false);
    const parsed = LandingInputSchema.safeParse(toInput(state));
    if (!parsed.success) {
      setErrors(parsed.error.issues.map(describeIssue));
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      const result = landingId ? await api.updateLanding(landingId, parsed.data) : await api.createLanding(parsed.data);
      setPersisted({ slug: result.slug, status: result.status });
      if (!landingId) {
        setLandingId(result.id);
        setLoaded(true);
        navigate(`/landings/${result.id}`, { replace: true });
      }
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors(['Esa dirección ya está en uso. Elige otra.']);
      else if (err instanceof ApiError && err.status === 400) setErrors(['El servidor rechazó los datos. Revisa los campos.']);
      else setErrors(['No se pudo guardar. Inténtalo de nuevo.']);
    } finally {
      setSaving(false);
      // setSaved(true) se ejecutó antes del efecto de limpieza; se reafirma tras el ciclo de render.
    }
  }

  if (!loaded && errors.length === 0) return <p className="admin-loading">Cargando…</p>;

  return (
    <section className="editor">
      <div className="admin-head">
        <h1>{landingId ? 'Editar landing' : 'Nueva landing'}</h1>
        <Link to="/" className="btn">
          Volver a la lista
        </Link>
      </div>

      <div className="editor-grid">
        <div className="editor-form">
          <div className="admin-card wide">
            <TextField label="Título de la landing" value={state.title} onChange={(value) => dispatch({ type: 'setTitle', value })} />
            <TextField
              label="Descripción"
              multiline
              value={state.description}
              hint="Aparece en la vista previa del enlace al compartirlo."
              onChange={(value) => dispatch({ type: 'setField', field: 'description', value })}
            />
            <TextField
              label="Dirección (slug)"
              value={state.slug}
              hint={`Será /l/${state.slug || '…'}. Solo minúsculas, números y guiones.`}
              onChange={(value) => dispatch({ type: 'setSlug', value })}
              onBlur={() => dispatch({ type: 'setSlug', value: normalizeSlug(state.slug) })}
            />
            <SelectField
              label="Theme"
              value={state.themeId}
              options={THEMES.map((t) => ({ value: t.id, label: t.name }))}
              onChange={(value) => dispatch({ type: 'setField', field: 'themeId', value })}
            />
            <SelectField
              label="Estado"
              value={state.status}
              options={[
                { value: 'draft', label: 'Borrador' },
                { value: 'published', label: 'Publicada' },
              ]}
              onChange={(value) => dispatch({ type: 'setField', field: 'status', value })}
            />
            <TextField
              label="Enlace del botón (opcional)"
              type="url"
              value={state.ctaUrl}
              placeholder="https://whatsapp.com/channel/…"
              hint="Si lo dejas vacío se usa el canal de Ajustes."
              onChange={(value) => dispatch({ type: 'setField', field: 'ctaUrl', value })}
            />
          </div>

          <SlideList slides={state.slides} dispatch={dispatch} />

          {errors.length > 0 && (
            <div role="alert" className="admin-error">
              <ul>
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="save-bar">
            <button type="button" className="btn solid" disabled={saving} onClick={save}>
              Guardar
            </button>
            {saved && <span className="admin-ok">Guardado</span>}
          </div>
        </div>

        <aside className="editor-side">
          {landingId && persisted && (
            <QrPanel id={landingId} slug={persisted.slug} status={persisted.status} dirty={state.slug !== persisted.slug} />
          )}
          <h2>Vista previa</h2>
          <LivePreview state={state} defaultCtaUrl={defaultCtaUrl} />
        </aside>
      </div>
    </section>
  );
}
