import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api';

export function Settings() {
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDefaultCtaUrl()
      .then((r) => setUrl(r.url ?? ''))
      .catch(() => setError('No se pudo cargar el ajuste.'));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    try {
      await api.setDefaultCtaUrl(url.trim() === '' ? null : url.trim());
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setError('El enlace debe ser un enlace https de WhatsApp (whatsapp.com, chat.whatsapp.com o wa.me).');
      else setError('No se pudo guardar.');
    }
  }

  return (
    <section>
      <div className="admin-head">
        <h1>Ajustes</h1>
      </div>
      <form onSubmit={submit} className="admin-card">
        <label>
          Enlace del canal de WhatsApp (por defecto)
          <input
            type="url"
            inputMode="url"
            placeholder="https://whatsapp.com/channel/…"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <p className="admin-hint">
          Es el destino del botón "Entrar al canal" en todas las landings que no tengan su propio enlace. Déjalo vacío para no mostrar botón.
        </p>
        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
        {saved && <p className="admin-ok">Guardado</p>}
        <button type="submit" className="btn solid">
          Guardar
        </button>
      </form>
    </section>
  );
}
