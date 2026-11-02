import { useEffect, useRef, useState, type Dispatch } from 'react';
import { MAX_SLIDES, ANIMATIONS, type Animation, type SlideType } from '@veta-roja/shared';
import { ANIMATION_LABELS, SLIDE_TYPES, slideTypeLabel, type EditorAction } from '../editorState';
import type { Slide } from '@veta-roja/shared';
import { SelectField } from './fields';
import { SlideFields } from './slideForms';
import { EXIT_MS, prefersReducedMotion } from '../motion';

interface Props {
  slides: Slide[];
  dispatch: Dispatch<EditorAction>;
}

export function SlideList({ slides, dispatch }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [newType, setNewType] = useState<SlideType>('emphasis_text');
  const known = useRef<Set<string> | null>(null);
  // Tarjetas que están animando su salida antes de quitarse.
  const [leaving, setLeaving] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function removeWithExit(id: string) {
    if (prefersReducedMotion()) return dispatch({ type: 'removeSlide', id });
    setLeaving(id);
    timer.current = setTimeout(() => {
      setLeaving(null);
      dispatch({ type: 'removeSlide', id });
    }, EXIT_MS);
  }

  // Cuando aparece una sola diapositiva nueva (agregada o duplicada), se abre para editarla.
  useEffect(() => {
    const current = new Set(slides.map((s) => s.id));
    if (known.current) {
      const fresh = slides.filter((s) => !known.current!.has(s.id));
      if (fresh.length === 1) setOpenId(fresh[0].id);
    }
    known.current = current;
  }, [slides]);

  const full = slides.length >= MAX_SLIDES;

  return (
    <section className="slide-list" aria-label="Diapositivas">
      <h2>Diapositivas</h2>
      <div className="add-slide">
        <SelectField
          label="Tipo de diapositiva"
          value={newType}
          options={SLIDE_TYPES.map((t) => ({ value: t.type, label: t.label }))}
          onChange={(value) => setNewType(value as SlideType)}
        />
        <button type="button" className="btn solid" disabled={full} onClick={() => dispatch({ type: 'addSlide', slideType: newType })}>
          Agregar diapositiva
        </button>
      </div>
      {full && <p className="admin-hint">Máximo {MAX_SLIDES} diapositivas por landing.</p>}
      {slides.length === 0 && <p className="admin-hint">Todavía no hay diapositivas. Agrega la primera con el selector de arriba.</p>}

      <ol className="slides">
        {slides.map((slide, i) => {
          const n = i + 1;
          const open = openId === slide.id;
          return (
            <li key={slide.id} className={`slide-card${slide.hidden ? ' is-hidden' : ''}${leaving === slide.id ? ' is-leaving' : ''}`}>
              <div className="slide-card-head">
                <h3>
                  <button type="button" className="slide-toggle" aria-expanded={open} onClick={() => setOpenId(open ? null : slide.id)}>
                    {`Diapositiva ${n} · ${slideTypeLabel(slide.type)}`}
                  </button>
                </h3>
                {slide.hidden && <span className="pill draft">Oculta</span>}
                <div className="slide-tools">
                  <button type="button" className="btn" aria-label={`Subir diapositiva ${n}`} disabled={i === 0} onClick={() => dispatch({ type: 'moveSlide', id: slide.id, direction: -1 })}>
                    ↑
                  </button>
                  <button type="button" className="btn" aria-label={`Bajar diapositiva ${n}`} disabled={i === slides.length - 1} onClick={() => dispatch({ type: 'moveSlide', id: slide.id, direction: 1 })}>
                    ↓
                  </button>
                  <button type="button" className="btn" aria-label={`${slide.hidden ? 'Mostrar' : 'Ocultar'} diapositiva ${n}`} onClick={() => dispatch({ type: 'toggleHidden', id: slide.id })}>
                    {slide.hidden ? 'Mostrar' : 'Ocultar'}
                  </button>
                  <button type="button" className="btn" aria-label={`Duplicar diapositiva ${n}`} disabled={full} onClick={() => dispatch({ type: 'duplicateSlide', id: slide.id })}>
                    Duplicar
                  </button>
                  <button type="button" className="btn danger" aria-label={`Eliminar diapositiva ${n}`} disabled={leaving !== null} onClick={() => removeWithExit(slide.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
              {open && (
                <div className="slide-card-body">
                  <SelectField
                    label="Animación de entrada"
                    value={slide.animation}
                    options={ANIMATIONS.map((a) => ({ value: a, label: ANIMATION_LABELS[a] }))}
                    onChange={(animation) => dispatch({ type: 'updateSlide', id: slide.id, patch: { animation: animation as Animation } })}
                  />
                  <SlideFields slide={slide} slides={slides} onChange={(patch) => dispatch({ type: 'updateSlide', id: slide.id, patch })} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
