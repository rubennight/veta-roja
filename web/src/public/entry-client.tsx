import '../render/render.css';
import { hydrateRoot } from 'react-dom/client';
import { SlideDeck } from '../render/SlideDeck';
import { uploadUrl } from '../render/urls';
import type { PublicDeckData } from './entry-server';

const island = document.getElementById('__DECK__');
const root = document.getElementById('root');

if (island?.textContent && root) {
  const data = JSON.parse(island.textContent) as PublicDeckData;
  hydrateRoot(root, <SlideDeck {...data} imageUrl={uploadUrl} />);
}
