import { useState } from 'react';

interface Props {
  id: string;
  /** Slug GUARDADO: el servidor genera el QR a partir de él, no de lo que se está escribiendo. */
  slug: string;
  /** Estado GUARDADO de la landing. */
  status: 'draft' | 'published';
  /** Hay cambios sin guardar en la dirección: el QR mostrado todavía es el anterior. */
  dirty: boolean;
}

/** El QR de la landing, generado por el servidor, listo para descargar e imprimir. */
export function QrPanel({ id, slug, status, dirty }: Props) {
  const [copied, setCopied] = useState(false);
  const base = `/api/admin/landings/${id}`;
  const publicUrl = `${window.location.origin}/l/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="qr-panel" aria-label="Código QR">
      <h2>Código QR</h2>
      <img className="qr-image" src={`${base}/qr.png?v=${encodeURIComponent(slug)}`} alt={`Código QR de /l/${slug}`} width={220} height={220} />
      <div className="qr-info">
        <p className="qr-url">{publicUrl}</p>
        <div className="qr-actions">
          <a className="btn solid" href={`${base}/qr.png?download=1`} download>
            Descargar PNG
          </a>
          <a className="btn" href={`${base}/qr.svg?download=1`} download>
            Descargar SVG
          </a>
          <button type="button" className="btn" aria-label="Copiar enlace" onClick={copy}>
            {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
        </div>
        {dirty && (
          <p className="admin-hint" role="status">
            Guarda para actualizar el QR: la dirección cambió y este QR todavía es el anterior.
          </p>
        )}
        {status === 'draft' && (
          <p className="admin-error" role="note">
            Esta landing está en borrador: el QR no funcionará hasta publicarla.
          </p>
        )}
        <p className="admin-hint">Si cambias la dirección, el QR ya impreso sigue funcionando (se redirige a la nueva).</p>
      </div>
    </section>
  );
}
