import { Fragment } from 'react';
import { parseInline } from '@veta-roja/shared';

/** Texto con **negrita** y ==resaltado==. Nunca inserta HTML: React escapa todo lo demás. */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, i) => {
        if (token.kind === 'bold') return <strong key={i}>{token.value}</strong>;
        if (token.kind === 'mark') return <mark key={i}>{token.value}</mark>;
        return <Fragment key={i}>{token.value}</Fragment>;
      })}
    </>
  );
}
