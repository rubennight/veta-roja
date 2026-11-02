import { Fragment } from 'react';
// Subruta ligera: el índice del paquete trae zod, que no debe viajar a la landing pública.
import { parseInline } from '@veta-roja/shared/inline';

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
