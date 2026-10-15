// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TutorialWelcomeSheet from './TutorialWelcomeSheet';

describe('TutorialWelcomeSheet (docs/26 §4.1, TUT-04)', () => {
  it('показывает предложение и обе кнопки', () => {
    render(<TutorialWelcomeSheet open onStart={() => {}} onDecline={() => {}} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Добро пожаловать в Shoppis!')).toBeInTheDocument();
    expect(screen.getByText('Создадим первый товар')).toBeInTheDocument();
    expect(screen.getByText('Посмотрим витрину глазами покупателя')).toBeInTheDocument();
    expect(screen.getByText('Поделимся магазином с покупателями')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Начать знакомство' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Позже' })).toBeInTheDocument();
  });

  it('«Начать знакомство» и «Позже» вызывают свои колбэки', async () => {
    const onStart = vi.fn();
    const onDecline = vi.fn();
    render(<TutorialWelcomeSheet open onStart={onStart} onDecline={onDecline} />);

    await userEvent.click(screen.getByRole('button', { name: 'Начать знакомство' }));
    await userEvent.click(screen.getByRole('button', { name: 'Позже' }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('закрытие по фону = отказ (§8.8)', async () => {
    const onDecline = vi.fn();
    render(<TutorialWelcomeSheet open onStart={() => {}} onDecline={onDecline} />);

    const overlay = document.querySelector('.sheet__overlay');
    expect(overlay).not.toBeNull();
    await userEvent.click(overlay as HTMLElement);

    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('open=false → шит не рендерится', () => {
    render(<TutorialWelcomeSheet open={false} onStart={() => {}} onDecline={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
