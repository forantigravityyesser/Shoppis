// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Globe } from 'lucide-react';
import SettingsRow from './SettingsRow';

describe('SettingsRow', () => {
  it('навигационная строка показывает заголовок, значение и вызывает onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <SettingsRow title="Язык и валюта" value="Русский · RUB" icon={Globe} onClick={onClick} />,
    );

    expect(screen.getByRole('button', { name: /Язык и валюта/ })).toBeInTheDocument();
    expect(screen.getByText('Русский · RUB')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Язык и валюта/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('toggle-строка показывает switch и вызывает onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SettingsRow
        title="Магазин активен"
        toggle={{ checked: true, label: 'Магазин активен', onChange }}
      />,
    );

    const toggle = screen.getByRole('switch', { name: 'Магазин активен' });
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('disabled toggle недоступен', () => {
    render(
      <SettingsRow
        title="Магазин активен"
        toggle={{ checked: false, label: 'Магазин активен', disabled: true, onChange: vi.fn() }}
      />,
    );

    expect(screen.getByRole('switch', { name: 'Магазин активен' })).toBeDisabled();
  });

  it('строка-действие: без chevron, с акцентным классом', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(<SettingsRow title="Предпросмотр" action onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'Предпросмотр' });
    expect(button).toHaveClass('settings-row--action');
    expect(container.querySelector('.settings-row__chevron')).toBeNull();

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
