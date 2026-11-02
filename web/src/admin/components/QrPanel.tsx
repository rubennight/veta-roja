import { useId, useState } from 'react';
import {
  DEFAULT_QR_STYLE,
  QR_BODY_SHAPES,
  QR_ECC_LEVELS,
  QR_EYE_BALLS,
  QR_EYE_FRAMES,
  QR_GRADIENTS,
  QR_LABELS,
  QrStyleSchema,
  contrastRatio,
  qrStyleToQuery,
  type QrStyle,
} from '@veta-roja/shared';
import { SelectField } from './fields';

interface Props {
  id: string;
  /** Slug GUARDADO: el servidor genera el QR a partir de él, no de lo que se está escribiendo. */
  slug: string;
  /** Estado GUARDADO de la landing. */
  status: 'draft' | 'published';
  /** Hay cambios sin guardar en la dirección: el QR mostrado todavía es el anterior. */
  dirty: boolean;
}

const SIZES = [512, 1024, 2048, 4096];
const options = <T extends string>(values: readonly T[], labels: Record<T, string>) => values.map((v) => ({ value: v, label: labels[v] }));

/** El estilo del QR se recuerda en este navegador, por landing. Nunca rompe si el almacenamiento no está disponible. */
const storageKey = (id: string) => `vr-qr-style:${id}`;
function loadStyle(id: string): QrStyle {
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    const parsed = raw ? QrStyleSchema.safeParse(JSON.parse(raw)) : null;
    return parsed?.success ? parsed.data : DEFAULT_QR_STYLE;
  } catch {
    return DEFAULT_QR_STYLE;
  }
}
function saveStyle(id: string, style: QrStyle) {
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(style));
  } catch {
    /* sin almacenamiento: el estilo solo dura mientras la página esté abierta */
  }
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const fieldId = useId();
  return (
    <div className="field color-field">
      <label htmlFor={fieldId}>{label}</label>
      <input id={fieldId} type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function RangeField({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  const fieldId = useId();
  return (
    <div className="field">
      <label htmlFor={fieldId}>{`${label}: ${value}${unit}`}</label>
      <input id={fieldId} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/** Avisos de legibilidad: sin contraste o con los colores invertidos, muchos lectores fallan. */
function readabilityWarnings(style: QrStyle): string[] {
  const background = style.bg === 'none' ? '#ffffff' : style.bg;
  const colors = style.gradient === 'none' ? [style.fg] : [style.fg, style.fg2];
  const all = [...colors, ...(style.eyeFrameColor ? [style.eyeFrameColor] : []), ...(style.eyeBallColor ? [style.eyeBallColor] : [])];
  const warnings: string[] = [];
  const worst = Math.min(...all.map((c) => contrastRatio(c, background)));
  if (worst < 4) warnings.push('Poco contraste entre el código y el fondo: puede no leerse bien. Usa colores más oscuros sobre un fondo claro.');
  if (all.some((c) => contrastRatio(c, '#000000') > contrastRatio(background, '#000000'))) {
    warnings.push('El código es más claro que el fondo (colores invertidos): algunos lectores de QR no lo reconocen.');
  }
  if (style.bg === 'none') warnings.push('Con fondo transparente, el QR se lee bien solo si se imprime sobre una superficie clara y lisa.');
  return warnings;
}

/** El QR de la landing, generado por el servidor, con estilo personalizable y listo para descargar e imprimir. */
export function QrPanel({ id, slug, status, dirty }: Props) {
  const [copied, setCopied] = useState(false);
  const [style, setStyle] = useState<QrStyle>(() => loadStyle(id));
  const update = (patch: Partial<QrStyle>) =>
    setStyle((current) => {
      const next = { ...current, ...patch };
      saveStyle(id, next);
      return next;
    });
  const reset = () => {
    setStyle(DEFAULT_QR_STYLE);
    saveStyle(id, DEFAULT_QR_STYLE);
  };

  const styleQuery = qrStyleToQuery(style);
  const extra = styleQuery ? `&${styleQuery}` : '';
  const base = `/api/admin/landings/${id}`;
  const publicUrl = `${window.location.origin}/l/${slug}`;
  const warnings = readabilityWarnings(style);
  const ownEyeColors = style.eyeFrameColor !== null || style.eyeBallColor !== null;
  const differs = styleQuery !== '';

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
      <img className="qr-image" src={`${base}/qr.png?v=${encodeURIComponent(slug)}${extra}`} alt={`Código QR de /l/${slug}`} width={220} height={220} />

      <details className="qr-style">
        <summary>Personalizar el QR</summary>

        <fieldset className="group">
          <legend>Forma</legend>
          <SelectField label="Forma de los módulos" value={style.body} options={options(QR_BODY_SHAPES, QR_LABELS.body)} onChange={(v) => update({ body: v as QrStyle['body'] })} />
          <SelectField label="Marco de los ojos" value={style.eyeFrame} options={options(QR_EYE_FRAMES, QR_LABELS.eyeFrame)} onChange={(v) => update({ eyeFrame: v as QrStyle['eyeFrame'] })} />
          <SelectField label="Centro de los ojos" value={style.eyeBall} options={options(QR_EYE_BALLS, QR_LABELS.eyeBall)} onChange={(v) => update({ eyeBall: v as QrStyle['eyeBall'] })} />
        </fieldset>

        <fieldset className="group">
          <legend>Color</legend>
          <ColorField label="Color del código" value={style.fg} onChange={(fg) => update({ fg })} />
          <SelectField label="Relleno" value={style.gradient} options={options(QR_GRADIENTS, QR_LABELS.gradient)} onChange={(v) => update({ gradient: v as QrStyle['gradient'] })} />
          {style.gradient !== 'none' && <ColorField label="Segundo color del degradado" value={style.fg2} onChange={(fg2) => update({ fg2 })} />}
          {style.gradient === 'linear' && <RangeField label="Ángulo del degradado" value={style.angle} min={0} max={360} unit="°" onChange={(angle) => update({ angle })} />}
          <label className="check">
            <input
              type="checkbox"
              checked={ownEyeColors}
              onChange={(e) => update(e.target.checked ? { eyeFrameColor: style.fg, eyeBallColor: style.fg } : { eyeFrameColor: null, eyeBallColor: null })}
            />
            Colores propios en los ojos
          </label>
          {ownEyeColors && (
            <>
              <ColorField label="Color del marco de los ojos" value={style.eyeFrameColor ?? style.fg} onChange={(eyeFrameColor) => update({ eyeFrameColor })} />
              <ColorField label="Color del centro de los ojos" value={style.eyeBallColor ?? style.fg} onChange={(eyeBallColor) => update({ eyeBallColor })} />
            </>
          )}
          <ColorField label="Color del fondo" value={style.bg === 'none' ? '#ffffff' : style.bg} disabled={style.bg === 'none'} onChange={(bg) => update({ bg })} />
          <label className="check">
            <input type="checkbox" checked={style.bg === 'none'} onChange={(e) => update({ bg: e.target.checked ? 'none' : '#ffffff' })} />
            Fondo transparente
          </label>
        </fieldset>

        <fieldset className="group">
          <legend>Emblema</legend>
          <label className="check">
            <input type="checkbox" checked={style.logo} onChange={(e) => update({ logo: e.target.checked })} />
            Martillo y hoz al centro
          </label>
          {style.logo && <RangeField label="Tamaño del emblema" value={style.logoSize} min={10} max={28} unit=" %" onChange={(logoSize) => update({ logoSize })} />}
        </fieldset>

        <fieldset className="group">
          <legend>Impresión</legend>
          <RangeField label="Margen" value={style.margin} min={0} max={10} unit=" módulos" onChange={(margin) => update({ margin })} />
          <SelectField label="Tamaño del PNG" value={String(style.size)} options={SIZES.map((s) => ({ value: String(s), label: `${s} × ${s} px` }))} onChange={(v) => update({ size: Number(v) })} />
          <SelectField
            label="Corrección de errores"
            value={style.logo ? 'H' : style.ecc}
            options={QR_ECC_LEVELS.map((l) => ({ value: l, label: { L: 'Baja (7 %)', M: 'Media (15 %)', Q: 'Alta (25 %)', H: 'Máxima (30 %)' }[l] }))}
            onChange={(v) => update({ ecc: v as QrStyle['ecc'] })}
          />
          {style.logo && <p className="admin-hint">Con el emblema se usa siempre la corrección máxima.</p>}
        </fieldset>

        {warnings.map((w) => (
          <p key={w} className="admin-error" role="note">
            {w}
          </p>
        ))}
        <button type="button" className="btn" disabled={!differs} onClick={reset}>
          Restablecer estilo
        </button>
        <p className="admin-hint">Tu estilo se recuerda en este navegador. Prueba siempre el QR con un celular antes de imprimir.</p>
      </details>

      <div className="qr-info">
        <p className="qr-url">{publicUrl}</p>
        <div className="qr-actions">
          <a className="btn solid" href={`${base}/qr.png?download=1${extra}`} download>
            Descargar PNG
          </a>
          <a className="btn" href={`${base}/qr.svg?download=1${extra}`} download>
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
