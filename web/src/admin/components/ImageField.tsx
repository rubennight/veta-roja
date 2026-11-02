import { useId, useState } from 'react';
import { ApiError, api } from '../api';
import { uploadUrl } from '../../render/urls';

interface Props {
  label: string;
  /** Id de la imagen subida, o '' si todavía no hay. */
  imageId: string;
  onChange: (imageId: string) => void;
  /** Permite quitar la imagen (para campos opcionales como la portada). */
  removable?: boolean;
}

export function ImageField({ label, imageId, onChange, removable }: Props) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await api.uploadImage(file);
      onChange(uploaded.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="image-field">
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <span id={`${id}-hint`} className="field-hint">
          JPEG, PNG o WebP, hasta 5 MB.
        </span>
      </div>
      {busy && <p className="admin-hint">Subiendo…</p>}
      {imageId && (
        <div className="thumb">
          <img src={uploadUrl(imageId)} alt="Imagen subida" />
          {removable && (
            <button type="button" className="btn" onClick={() => onChange('')}>
              Quitar imagen
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
    </div>
  );
}
