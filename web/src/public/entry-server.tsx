import { renderToString } from 'react-dom/server';
import type { Slide } from '@veta-roja/shared';
import { SlideDeck } from '../render/SlideDeck';
import { uploadUrl } from '../render/urls';

/** Datos que el servidor inyecta en la página y el cliente usa para hidratar. */
export interface PublicDeckData {
  slides: Slide[];
  ctaUrl: string | null;
  themeId: string;
}

export function renderDeck(data: PublicDeckData): string {
  return renderToString(<SlideDeck {...data} imageUrl={uploadUrl} />);
}
