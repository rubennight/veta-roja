import type { Slide } from '@veta-roja/shared';
import { InlineText } from '../InlineText';

type Of<T extends Slide['type']> = Extract<Slide, { type: T }>;

export interface SlideContext {
  ctaUrl: string | null;
  imageUrl: (imageId: string) => string;
}

export function Cover({ slide, ctx }: { slide: Of<'cover'>; ctx: SlideContext }) {
  return (
    <>
      {slide.imageId && <img className="cover-image" src={ctx.imageUrl(slide.imageId)} alt="" />}
      <div className="slide-inner">
        <h1 className="slide-title">{slide.title}</h1>
        {slide.subtitle && <p className="slide-subtitle">{slide.subtitle}</p>}
      </div>
    </>
  );
}

export function EmphasisText({ slide }: { slide: Of<'emphasis_text'> }) {
  return (
    <div className="slide-inner">
      <p className="slide-text">
        <InlineText text={slide.text} />
      </p>
    </div>
  );
}

export function Quote({ slide }: { slide: Of<'quote'> }) {
  return (
    <div className="slide-inner">
      <blockquote className="slide-quote">
        <p>
          <InlineText text={slide.text} />
        </p>
        {(slide.author || slide.date) && (
          <footer>
            {slide.author && <cite>{slide.author}</cite>}
            {slide.date && <time>{slide.date}</time>}
          </footer>
        )}
      </blockquote>
    </div>
  );
}

export function Concept({ slide }: { slide: Of<'concept'> }) {
  return (
    <div className="slide-inner">
      <aside className="concept-box">
        <h2 className="concept-term">{slide.term}</h2>
        <p className="concept-definition">
          <InlineText text={slide.definition} />
        </p>
      </aside>
    </div>
  );
}

export function BigFigure({ slide }: { slide: Of<'big_figure'> }) {
  return (
    <div className="slide-inner">
      <p className="figure-number">{slide.figure}</p>
      <p className="figure-caption">{slide.caption}</p>
    </div>
  );
}

export function Timeline({ slide }: { slide: Of<'timeline'> }) {
  return (
    <div className="slide-inner">
      <ol className="timeline">
        {slide.items.map((item, i) => (
          <li key={i}>
            <time>{item.date}</time>
            <p>
              <InlineText text={item.text} />
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Comparison({ slide }: { slide: Of<'comparison'> }) {
  const column = (c: Of<'comparison'>['left'], side: string) => (
    <div className={`compare-col compare-${side}`}>
      <h2>{c.title}</h2>
      <ul>
        {c.points.map((p, i) => (
          <li key={i}>
            <InlineText text={p} />
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="slide-inner compare">
      {column(slide.left, 'left')}
      {column(slide.right, 'right')}
    </div>
  );
}

export function Gallery({ slide, ctx }: { slide: Of<'gallery'>; ctx: SlideContext }) {
  return (
    <div className="slide-inner">
      <div className="gallery">
        {slide.images
          .filter((img) => img.imageId !== '')
          .map((img, i) => (
            <figure key={i}>
              <img src={ctx.imageUrl(img.imageId)} alt={img.caption ?? ''} loading="lazy" />
              {img.caption && <figcaption>{img.caption}</figcaption>}
            </figure>
          ))}
      </div>
    </div>
  );
}

export function Cta({ slide, ctx }: { slide: Of<'cta'>; ctx: SlideContext }) {
  return (
    <div className="slide-inner">
      <p className="slide-text">
        <InlineText text={slide.text} />
      </p>
      {ctx.ctaUrl && (
        <a className="btn-cta" href={ctx.ctaUrl} target="_blank" rel="noopener noreferrer">
          {slide.buttonLabel}
        </a>
      )}
    </div>
  );
}
