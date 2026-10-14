// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SectionSwitcher from './SectionSwitcher';

const tabs = [
  { value: 'earned' as const, label: 'Заработано' },
  { value: 'potential' as const, label: 'Потенциальные' },
];

describe('SectionSwitcher', () => {
  it('рендерит табы и отмечает активный', () => {
    render(
      <SectionSwitcher tabs={tabs} value="earned" onChange={vi.fn()} ariaLabel="Разделы продаж" />,
    );
    expect(screen.getByRole('tablist', { name: 'Разделы продаж' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Заработано' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Потенциальные' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('клик переключает значение', async () => {
    const onChange = vi.fn();
    render(
      <SectionSwitcher tabs={tabs} value="earned" onChange={onChange} ariaLabel="Разделы продаж" />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Потенциальные' }));
    expect(onChange).toHaveBeenCalledWith('potential');
  });
});
