import type { Slide } from '@veta-roja/shared';
import { ImageField } from './ImageField';
import { TextField } from './fields';

type Of<T extends Slide['type']> = Extract<Slide, { type: T }>;
type Patch = (patch: Partial<Slide>) => void;

const EMPHASIS_HINT = 'Usa **negritas** y ==resaltados== para dar énfasis.';

function replaceAt<T>(list: T[], index: number, value: T): T[] {
  return list.map((item, i) => (i === index ? value : item));
}

/** Campos propios de cada tipo de diapositiva. */
export function SlideFields({ slide, onChange }: { slide: Slide; onChange: Patch }) {
  switch (slide.type) {
    case 'cover':
      return <CoverFields slide={slide} onChange={onChange} />;
    case 'emphasis_text':
      return <TextField label="Texto" multiline value={slide.text} hint={EMPHASIS_HINT} onChange={(text) => onChange({ text })} />;
    case 'quote':
      return (
        <>
          <TextField label="Frase" multiline value={slide.text} onChange={(text) => onChange({ text })} />
          <TextField label="Autor" value={slide.author ?? ''} onChange={(author) => onChange({ author })} />
          <TextField label="Fecha" value={slide.date ?? ''} onChange={(date) => onChange({ date })} />
        </>
      );
    case 'concept':
      return (
        <>
          <TextField label="Término" value={slide.term} onChange={(term) => onChange({ term })} />
          <TextField label="Definición" multiline value={slide.definition} hint={EMPHASIS_HINT} onChange={(definition) => onChange({ definition })} />
        </>
      );
    case 'big_figure':
      return (
        <>
          <TextField label="Cifra" value={slide.figure} onChange={(figure) => onChange({ figure })} />
          <TextField label="Explicación" value={slide.caption} onChange={(caption) => onChange({ caption })} />
        </>
      );
    case 'timeline':
      return <TimelineFields slide={slide} onChange={onChange} />;
    case 'comparison':
      return <ComparisonFields slide={slide} onChange={onChange} />;
    case 'gallery':
      return <GalleryFields slide={slide} onChange={onChange} />;
    case 'cta':
      return (
        <>
          <TextField label="Texto" multiline value={slide.text} hint={EMPHASIS_HINT} onChange={(text) => onChange({ text })} />
          <TextField label="Texto del botón" value={slide.buttonLabel} onChange={(buttonLabel) => onChange({ buttonLabel })} />
          <p className="admin-hint">El botón lleva al canal de WhatsApp: el de esta landing o, si no tiene, el de Ajustes.</p>
        </>
      );
  }
}

function CoverFields({ slide, onChange }: { slide: Of<'cover'>; onChange: Patch }) {
  return (
    <>
      <TextField label="Título" value={slide.title} onChange={(title) => onChange({ title })} />
      <TextField label="Subtítulo" value={slide.subtitle ?? ''} onChange={(subtitle) => onChange({ subtitle })} />
      <ImageField
        label="Imagen de fondo"
        imageId={slide.imageId ?? ''}
        removable
        onChange={(id) => onChange({ imageId: id === '' ? undefined : id })}
      />
    </>
  );
}

function TimelineFields({ slide, onChange }: { slide: Of<'timeline'>; onChange: Patch }) {
  const set = (items: Of<'timeline'>['items']) => onChange({ items });
  return (
    <>
      {slide.items.map((item, i) => (
        <fieldset key={i} className="group">
          <legend>Hecho {i + 1}</legend>
          <TextField label={`Fecha ${i + 1}`} value={item.date} onChange={(date) => set(replaceAt(slide.items, i, { ...item, date }))} />
          <TextField label={`Hecho ${i + 1}`} multiline value={item.text} onChange={(text) => set(replaceAt(slide.items, i, { ...item, text }))} />
          <button type="button" className="btn danger" disabled={slide.items.length <= 1} onClick={() => set(slide.items.filter((_, j) => j !== i))}>
            {`Quitar hecho ${i + 1}`}
          </button>
        </fieldset>
      ))}
      <button type="button" className="btn" onClick={() => set([...slide.items, { date: '', text: '' }])}>
        Agregar hecho
      </button>
    </>
  );
}

function ComparisonFields({ slide, onChange }: { slide: Of<'comparison'>; onChange: Patch }) {
  const column = (side: 'left' | 'right', name: string) => (
    <fieldset className="group">
      <legend>{name}</legend>
      <TextField label={`Título (${name})`} value={slide[side].title} onChange={(title) => onChange({ [side]: { ...slide[side], title } })} />
      <TextField
        label={`Puntos (${name})`}
        multiline
        value={slide[side].points.join('\n')}
        hint="Un punto por línea."
        onChange={(value) => onChange({ [side]: { ...slide[side], points: value.split('\n') } })}
      />
    </fieldset>
  );
  return (
    <>
      {column('left', 'columna izquierda')}
      {column('right', 'columna derecha')}
    </>
  );
}

function GalleryFields({ slide, onChange }: { slide: Of<'gallery'>; onChange: Patch }) {
  const set = (images: Of<'gallery'>['images']) => onChange({ images });
  return (
    <>
      {slide.images.map((img, i) => (
        <fieldset key={i} className="group">
          <legend>Imagen {i + 1}</legend>
          <ImageField label={`Imagen ${i + 1}`} imageId={img.imageId} onChange={(imageId) => set(replaceAt(slide.images, i, { ...img, imageId }))} />
          <TextField label={`Pie de foto ${i + 1}`} value={img.caption ?? ''} onChange={(caption) => set(replaceAt(slide.images, i, { ...img, caption }))} />
          <button type="button" className="btn danger" onClick={() => set(slide.images.filter((_, j) => j !== i))}>
            {`Quitar imagen ${i + 1}`}
          </button>
        </fieldset>
      ))}
      <button type="button" className="btn" onClick={() => set([...slide.images, { imageId: '' }])}>
        Agregar imagen
      </button>
    </>
  );
}
