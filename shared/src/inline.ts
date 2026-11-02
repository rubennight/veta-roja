export type InlineToken = { kind: 'text' | 'bold' | 'mark'; value: string };

const MARKERS: Array<{ open: string; kind: 'bold' | 'mark' }> = [
  { open: '**', kind: 'bold' },
  { open: '==', kind: 'mark' },
];

/**
 * Convierte `**negrita**` y `==resaltado==` en tokens. Nunca interpreta HTML:
 * todo lo demás es texto. Un marcador sin cerrar queda como texto literal.
 */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) tokens.push({ kind: 'text', value: buffer });
    buffer = '';
  };

  let i = 0;
  while (i < text.length) {
    const marker = MARKERS.find((m) => text.startsWith(m.open, i));
    if (marker) {
      const start = i + marker.open.length;
      const end = text.indexOf(marker.open, start);
      if (end > start) {
        flush();
        tokens.push({ kind: marker.kind, value: text.slice(start, end) });
        i = end + marker.open.length;
        continue;
      }
    }
    buffer += text[i];
    i += 1;
  }
  flush();
  return tokens;
}
