// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { compressImage, cropToFile } = vi.hoisted(() => ({
  compressImage: vi.fn(),
  cropToFile: vi.fn(),
}));

vi.mock('../../../utils/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/image')>();
  return { ...actual, compressImage, cropToFile };
});

// Cropper — тяжёлый канвас-компонент; заменяем на заглушку, которая сразу
// сообщает валидную область кропа, чтобы проверить логику sheet.
vi.mock('react-easy-crop', async () => {
  const React = await import('react');
  function CropperMock({ onCropComplete }: { onCropComplete: (a: unknown, b: unknown) => void }) {
    React.useEffect(() => {
      onCropComplete(
        { x: 0, y: 0, width: 1, height: 1 },
        { x: 10, y: 20, width: 800, height: 400 },
      );
    }, [onCropComplete]);
    return React.createElement('div', { 'data-testid': 'cropper-mock' });
  }
  return { default: CropperMock };
});

import ImageCropSheet from './ImageCropSheet';

const CROPPED = new File(['cropped'], 'cropped.webp', { type: 'image/webp' });

beforeEach(() => {
  compressImage.mockReset().mockImplementation(async (file: File) => file);
  cropToFile.mockReset().mockResolvedValue(CROPPED);
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});

function renderSheet(onConfirm = vi.fn(), onClose = vi.fn()) {
  const file = new File(['x'], 'src.png', { type: 'image/png' });
  const utils = render(
    <ImageCropSheet
      open
      file={file}
      aspect={2.2}
      title="Кадрировать баннер"
      outputWidth={1100}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );
  return { ...utils, onConfirm, onClose, file };
}

describe('ImageCropSheet', () => {
  it('готовит рабочую копию и рендерит кроппер', async () => {
    renderSheet();

    expect(await screen.findByTestId('cropper-mock')).toBeInTheDocument();
    expect(compressImage).toHaveBeenCalledTimes(1);
  });

  it('по подтверждению режет область с целевой шириной и отдаёт файл', async () => {
    const { onConfirm } = renderSheet();

    const confirm = await screen.findByRole('button', { name: 'Готово' });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.click(confirm);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(CROPPED));
    expect(cropToFile).toHaveBeenCalledWith(expect.any(File), expect.any(Object), 1100);
  });

  it('отмена не применяет правки', async () => {
    const { onConfirm, onClose } = renderSheet();

    await screen.findByTestId('cropper-mock');
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
