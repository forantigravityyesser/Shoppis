import { useEffect, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import BottomSheet from '../../../shared/components/BottomSheet';
import type { InventoryVariantItem } from '../../../../application/hooks/useProduct';
import type { UpdateVariantStockPatch } from '../../../../application/hooks/useInventoryActions';
import { useStore } from '../../../../application/store';
import AddVariantSheet from './AddVariantSheet';

interface StockControlSheetProps {
  open: boolean;
  productId: string;
  variants: InventoryVariantItem[];
  onClose: () => void;
}

interface StockRow {
  id: string;
  name: string;
  value: string;
  available: string;
  held: string;
}

function toRows(variants: InventoryVariantItem[]): StockRow[] {
  return variants.map((v) => ({
    id: v.id,
    name: v.name,
    value: v.value,
    available: String(v.availableQuantity),
    held: String(v.heldQuantity),
  }));
}

function toInt(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/**
 * Контроль остатков: строки «размерность / значение / в наличии / в ожидании».
 * Продавец правит числа напрямую; «Всё в наличии» переносит held → available (02 §4).
 */
export default function StockControlSheet({
  open,
  productId,
  variants,
  onClose,
}: StockControlSheetProps) {
  const updateVariantStock = useStore((s) => s.updateVariantStock);
  const [rows, setRows] = useState<StockRow[]>(() => toRows(variants));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRows(toRows(variants));
      setExpandedId(null);
      setSaveError(null);
    }
  }, [open, variants]);

  const setRow = (index: number, patch: Partial<StockRow>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const moveAll = (index: number) =>
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? { ...row, available: String(toInt(row.available) + toInt(row.held)), held: '0' }
          : row,
      ),
    );

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const changes: Array<{ id: string; patch: UpdateVariantStockPatch }> = [];
      for (const row of rows) {
        const origin = variants.find((v) => v.id === row.id);
        const available = toInt(row.available);
        const held = toInt(row.held);
        const patch: UpdateVariantStockPatch = {};
        if (!origin || available !== origin.availableQuantity) patch.availableQuantity = available;
        if (!origin || held !== origin.heldQuantity) patch.heldQuantity = held;
        if (Object.keys(patch).length > 0) changes.push({ id: row.id, patch });
      }
      await Promise.all(changes.map(({ id, patch }) => updateVariantStock(id, patch)));
      onClose();
    } catch (e) {
      console.error('[inventory] stock save failed', e);
      setSaveError('Не удалось сохранить остатки. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="sheet__title">Контроль остатков</h2>

      {rows.length === 0 ? (
        <div className="card__muted">Нет вариантов для управления остатками.</div>
      ) : (
        <div className="stock-list">
          {rows.map((row, index) => {
            const expanded = expandedId === row.id;
            const held = toInt(row.held);
            return (
              <div className={`stock-item${expanded ? ' stock-item--open' : ''}`} key={row.id}>
                <button
                  type="button"
                  className="stock-item__row"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                >
                  <span className="stock-item__name">
                    <span className="stock-item__type">{row.name}</span>
                    <span className="stock-item__value">{row.value}</span>
                  </span>
                  <span className="stock-item__counts">
                    <span className="stock-item__count">
                      <span className="stock-item__count-num">{toInt(row.available)}</span>
                      <span className="stock-item__count-label">в наличии</span>
                    </span>
                    <span
                      className={`stock-item__count${held > 0 ? ' stock-item__count--held' : ''}`}
                    >
                      <span className="stock-item__count-num">{held}</span>
                      <span className="stock-item__count-label">в ожидании</span>
                    </span>
                  </span>
                  <ChevronDown
                    className="stock-item__chevron"
                    size={18}
                    aria-hidden
                  />
                </button>

                {expanded ? (
                  <div className="stock-item__editor">
                    <div className="field__row">
                      <label className="field">
                        <span className="field__label">В наличии</span>
                        <input
                          className="field__input"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={row.available}
                          onChange={(e) => setRow(index, { available: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">В ожидании</span>
                        <input
                          className="field__input"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={row.held}
                          onChange={(e) => setRow(index, { held: e.target.value })}
                        />
                      </label>
                    </div>
                    {held > 0 ? (
                      <button
                        type="button"
                        className="stock-row__move"
                        onClick={() => moveAll(index)}
                      >
                        Всё в наличии
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <button type="button" className="char-add" onClick={() => setAddOpen(true)}>
        <Plus size={16} strokeWidth={2.5} />
        <span>Добавить вариант</span>
      </button>

      {saveError ? (
        <div style={{ marginTop: 8, color: '#FF3B30', fontSize: 13 }}>{saveError}</div>
      ) : null}

      <div className="form-actions">
        <button
          type="button"
          className="btn-primary btn-primary--wide"
          disabled={rows.length === 0 || saving}
          onClick={save}
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>

      <AddVariantSheet open={addOpen} productId={productId} onClose={() => setAddOpen(false)} />
    </BottomSheet>
  );
}
