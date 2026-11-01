import { describe, expect, it } from 'vitest';
import { parseInline } from '../src/inline';

describe('parseInline', () => {
  it('"a **b** ==c==" produce text, bold, text, mark', () => {
    expect(parseInline('a **b** ==c==')).toEqual([
      { kind: 'text', value: 'a ' },
      { kind: 'bold', value: 'b' },
      { kind: 'text', value: ' ' },
      { kind: 'mark', value: 'c' },
    ]);
  });
  it('un marcador sin cerrar queda como texto literal', () => {
    expect(parseInline('**sin cerrar')).toEqual([{ kind: 'text', value: '**sin cerrar' }]);
    expect(parseInline('==abierto')).toEqual([{ kind: 'text', value: '==abierto' }]);
  });
  it('no interpreta HTML: lo deja como texto', () => {
    expect(parseInline('<b>x</b>')).toEqual([{ kind: 'text', value: '<b>x</b>' }]);
  });
  it('texto vacío produce lista vacía', () => {
    expect(parseInline('')).toEqual([]);
  });
});
