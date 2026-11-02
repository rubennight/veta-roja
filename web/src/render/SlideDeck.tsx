import { useCallback, useEffect, useRef, useState } from 'react';
import type { Slide } from '@veta-roja/shared';
import { useReveal } from './useReveal';
import { BigFigure, Comparison, Concept, Cover, Cta, EmphasisText, Gallery, Quote, Timeline, type SlideContext } from './slides';

export interface DeckProps {
  slides: Slide[];
  ctaUrl: string | null;
  imageUrl: (imageId: string) => string;
  themeId: string;
  /** Teclas ↑ ↓ / AvPág / RePág / espacio para cambiar de diapositiva. Se desactiva en la vista previa del panel. */
  keyboard?: boolean;
}

function SlideBody({ slide, ctx }: { slide: Slide; ctx: SlideContext }) {
  switch (slide.type) {
    case 'cover':
      return <Cover slide={slide} ctx={ctx} />;
    case 'emphasis_text':
      return <EmphasisText slide={slide} />;
    case 'quote':
      return <Quote slide={slide} />;
    case 'concept':
      return <Concept slide={slide} />;
    case 'big_figure':
      return <BigFigure slide={slide} />;
    case 'timeline':
      return <Timeline slide={slide} />;
    case 'comparison':
      return <Comparison slide={slide} />;
    case 'gallery':
      return <Gallery slide={slide} ctx={ctx} />;
    case 'cta':
      return <Cta slide={slide} ctx={ctx} />;
  }
}

/** Landing en forma de presentación: una diapositiva por pantalla, desplazamiento vertical con imán. */
export function SlideDeck({ slides, ctaUrl, imageUrl, themeId, keyboard = true }: DeckProps) {
  const visible = slides.filter((s) => !s.hidden);
  const rootRef = useRef<HTMLElement | null>(null);
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  currentRef.current = current;

  useReveal(rootRef, visible.length, setCurrent);

  const goTo = useCallback((index: number) => {
    const sections = rootRef.current?.querySelectorAll<HTMLElement>('section.slide');
    sections?.[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      // Nunca interferir cuando se está escribiendo en un campo (p. ej. en el editor del panel).
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const total = rootRef.current?.querySelectorAll('section.slide').length ?? 0;
      const i = currentRef.current;
      if (['ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey)) {
        if (i < total - 1) {
          e.preventDefault();
          goTo(i + 1);
        }
      } else if (['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey)) {
        if (i > 0) {
          e.preventDefault();
          goTo(i - 1);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, keyboard]);

  const ctx: SlideContext = { ctaUrl, imageUrl };

  return (
    <main className="deck" data-theme={themeId} ref={rootRef}>
      {visible.map((slide) => (
        <section key={slide.id} className="slide" data-slide-type={slide.type} data-animation={slide.animation}>
          <SlideBody slide={slide} ctx={ctx} />
        </section>
      ))}
      <nav key={current} className="progress" aria-label="Progreso">
        {Math.min(current + 1, visible.length)}/{visible.length}
      </nav>
    </main>
  );
}
