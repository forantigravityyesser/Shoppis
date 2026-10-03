import { describe, it, expect } from 'vitest';
import { sellerAvatarInitial } from './seller-avatar';

describe('sellerAvatarInitial', () => {
  it('берёт первую букву и делает заглавной', () => {
    expect(sellerAvatarInitial('Александр')).toBe('А');
    expect(sellerAvatarInitial('John')).toBe('J');
    expect(sellerAvatarInitial('мария')).toBe('М');
  });

  it('игнорирует пробелы по краям', () => {
    expect(sellerAvatarInitial('  nike shop  ')).toBe('N');
  });

  it('пустое/отсутствующее имя → ?', () => {
    expect(sellerAvatarInitial('')).toBe('?');
    expect(sellerAvatarInitial('   ')).toBe('?');
    expect(sellerAvatarInitial(null)).toBe('?');
    expect(sellerAvatarInitial(undefined)).toBe('?');
  });

  it('не разрезает эмодзи/суррогатные пары', () => {
    expect(sellerAvatarInitial('🎉 party')).toBe('🎉');
  });
});
