// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  updateVariantStock: vi.fn(),
  moveHeldToAvailable: vi.fn(),
}));

vi.mock('../../../shared/components/BottomSheet', () => ({
  default: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
}));
vi.mock('./AddVariantSheet', () => ({ default: () => null }));
vi.mock('../../../../application/store', () => ({
  useStore: (selector: (s: unknown) => unknown) =>
    selector({
      updateVariantStock: mocks.updateVariantStock,
      moveHeldToAvailable: mocks.moveHeldToAvailable,
    }),
}));

import StockControlSheet from './StockControlSheet';
import type { InventoryVariantItem } from '../../../../application/read-models/inventory-view';

const VARIANT: InventoryVariantItem = {
  id: 'v1',
  name: 'Размер',
  value: 'M',
  originalAmountMinor: 10000,
  priceMinor: 10000,
  discountPercent: 0,
  availableQuantity: 5,
  heldQuantity: 3,
  priceMode: 'USE_PRODUCT_PRICE',
  customOriginalAmountMinor: null,
  customDiscountPercent: null,
};

function renderSheet() {
  return render(
    <StockControlSheet open productId="p1" variants={[VARIANT]} onClose={() => {}} />,
  );
}

function expandRow() {
  fireEvent.click(screen.getByRole('button', { name: /Размер/ }));
}

beforeEach(() => {
  mocks.updateVariantStock.mockReset();
  mocks.updateVariantStock.mockResolvedValue(undefined);
  mocks.moveHeldToAvailable.mockReset();
  mocks.moveHeldToAvailable.mockResolvedValue(undefined);
});

describe('StockControlSheet — held custody (docs/21 §3.4)', () => {
  it('«В ожидании» — read-only', () => {
    renderSheet();
    expandRow();
    expect(screen.getByTestId('stock-held-v1')).toHaveAttribute('readonly');
  });

  it('«Всё в наличии» → moveHeldToAvailable (lifecycle), без прямой записи стока', async () => {
    renderSheet();
    expandRow();
    fireEvent.click(screen.getByText('Всё в наличии'));
    await waitFor(() => expect(mocks.moveHeldToAvailable).toHaveBeenCalledWith('v1'));
    expect(mocks.updateVariantStock).not.toHaveBeenCalled();
  });

  it('save пишет только availableQuantity (held не трогаем)', async () => {
    renderSheet();
    expandRow();
    fireEvent.change(screen.getByTestId('stock-available-v1'), { target: { value: '7' } });
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() =>
      expect(mocks.updateVariantStock).toHaveBeenCalledWith('v1', { availableQuantity: 7 }),
    );
  });
});
