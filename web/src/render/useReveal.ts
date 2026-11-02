import { useEffect, useRef, type RefObject } from 'react';

/**
 * Observa las diapositivas (`section.slide`) del deck:
 * - marca `.is-visible` cuando entran en pantalla (dispara su animación de entrada) y la quita al salir,
 *   con `data-exit="up|down"` según el lado por el que se van (dispara la animación de salida);
 * - avisa con `onActive(índice)` cuál es la diapositiva principal en pantalla;
 * - con `prefers-reduced-motion`, las muestra todas desde el inicio.
 * También agrega `.js` a la raíz: sin JavaScript todo el contenido sigue visible.
 * `slideCount` hace que se vuelva a observar cuando cambia la cantidad (vista previa del panel).
 */
export function useReveal(
  rootRef: RefObject<HTMLElement | null>,
  slideCount: number,
  onActive?: (index: number) => void,
): void {
  const onActiveRef = useRef(onActive);
  onActiveRef.current = onActive;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('section.slide'));
    root.classList.add('js');

    const reduced =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      sections.forEach((s) => s.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
            // Entrada.
            el.removeAttribute('data-exit');
            el.classList.add('is-visible');
            if (entry.intersectionRatio >= 0.5) onActiveRef.current?.(sections.indexOf(el));
          } else if (!entry.isIntersecting || entry.intersectionRatio < 0.15) {
            // Salida: se anima hacia el lado por el que se va (arriba si ya pasó, abajo si aún no llega).
            if (el.classList.contains('is-visible')) {
              el.setAttribute('data-exit', el.getBoundingClientRect().top < 0 ? 'up' : 'down');
              el.classList.remove('is-visible');
            }
          }
        }
      },
      { threshold: [0, 0.15, 0.25, 0.5, 0.9] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [rootRef, slideCount]);
}
