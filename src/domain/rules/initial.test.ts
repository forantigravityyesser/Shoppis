import { describe, it, expect } from 'vitest';
import { getInitial } from './initial';

describe('getInitial', () => {
  it('берёт первую букву и приводит к верхнему регистру', () => {
    expect(getInitial('Александр')).toBe('А');
    expect(getInitial('John')).toBe('J');
    expect(getInitial('мария')).toBe('М');
  });

  it('тримит пробелы', () => {
    expect(getInitial('  nike shop  ')).toBe('N');
  });

  it('пустое значение → «?»', () => {
    expect(getInitial('')).toBe('?');
    expect(getInitial('   ')).toBe('?');
    expect(getInitial(null)).toBe('?');
    expect(getInitial(undefined)).toBe('?');
  });

  it('не режет эмодзи/суррогатные пары', () => {
    expect(getInitial('🎉 party')).toBe('🎉');
  });
});
