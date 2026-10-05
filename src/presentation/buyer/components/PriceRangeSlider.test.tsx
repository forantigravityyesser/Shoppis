// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import PriceRangeSlider from './PriceRangeSlider';

describe('PriceRangeSlider', () => {
  it('показывает значения (minor→валюта) и два ползунка', () => {
    render(
      <PriceRangeSlider
        min={8000}
        max={320000}
        valueMin={8000}
        valueMax={320000}
        symbol="€"
        onChangeMin={vi.fn()}
        onChangeMax={vi.fn()}
      />,
    );

    expect(screen.getByText('80 €')).toBeInTheDocument();
    expect(screen.getByText('3200 €')).toBeInTheDocument();
    expect((screen.getByLabelText('Цена от') as HTMLInputElement).value).toBe('8000');
    expect((screen.getByLabelText('Цена до') as HTMLInputElement).value).toBe('320000');
  });

  it('изменение ползунков вызывает onChange с числом', () => {
    const onChangeMin = vi.fn();
    const onChangeMax = vi.fn();
    render(
      <PriceRangeSlider
        min={0}
        max={1000}
        valueMin={0}
        valueMax={1000}
        symbol="$"
        onChangeMin={onChangeMin}
        onChangeMax={onChangeMax}
      />,
    );

    fireEvent.change(screen.getByLabelText('Цена от'), { target: { value: '300' } });
    expect(onChangeMin).toHaveBeenCalledWith(300);

    fireEvent.change(screen.getByLabelText('Цена до'), { target: { value: '700' } });
    expect(onChangeMax).toHaveBeenCalledWith(700);
  });
});
