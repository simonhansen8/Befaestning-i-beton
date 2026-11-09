import { describe, expect, it } from 'vitest';
import { naesteTema } from './autogem';

describe('tema', () => {
  it('skifter system → mørk → lys → system', () => {
    expect(naesteTema('system')).toBe('moerk');
    expect(naesteTema('moerk')).toBe('lys');
    expect(naesteTema('lys')).toBe('system');
  });
});
