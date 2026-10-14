// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AttentionBlock from './AttentionBlock';

describe('AttentionBlock', () => {
  it('остаётся плейсхолдером о будущих улучшениях (docs/25 §4.4)', () => {
    render(<AttentionBlock />);
    const block = screen.getByTestId('dashboard-card');
    expect(block).toHaveTextContent('Требует внимания');
    expect(block).toHaveTextContent(/будущих обновлениях/i);
  });

  it('не интерактивен (не кнопка)', () => {
    render(<AttentionBlock />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
