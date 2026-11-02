import '../../render/render.css';
import { isAllowedCtaUrl } from '@veta-roja/shared';
import { SlideDeck } from '../../render/SlideDeck';
import { uploadUrl } from '../../render/urls';
import type { EditorState } from '../editorState';

interface Props {
  state: EditorState;
  /** Enlace de Ajustes, para cuando la landing no tiene uno propio. */
  defaultCtaUrl: string | null;
}

/** Vista previa en vivo: la misma presentación que verá el público, con el theme elegido. */
export function LivePreview({ state, defaultCtaUrl }: Props) {
  const own = state.ctaUrl.trim();
  // Nunca se enlaza un valor a medio escribir o no permitido (p. ej. javascript:).
  const ctaUrl = own !== '' && isAllowedCtaUrl(own) ? own : own === '' ? defaultCtaUrl : null;
  return (
    <div className="preview-frame" aria-label="Vista previa">
      <link rel="stylesheet" href={`/themes/${state.themeId}.css`} />
      <SlideDeck slides={state.slides} ctaUrl={ctaUrl} imageUrl={uploadUrl} themeId={state.themeId} keyboard={false} />
    </div>
  );
}
