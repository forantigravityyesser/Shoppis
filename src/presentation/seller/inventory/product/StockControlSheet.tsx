import { useEffect, useRef, useState } from 'react';
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
  held: number;
}

function toInt(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/**
 * Контроль остатков: строки «размерность / значение / в наличии / в ожидании».
 * Продавец правит только «в наличии»; «в ожидании» — read-only (это резерв под
 * заказы), перенос held → available идёт серверным `inventory_reconcile`
 * (docs/21 §3.4, 02 §4).
 */
export default function StockControlSheet({
  open,
  productId,
  variants,
  onClose,
}: StockControlSheetProps) {
  const updateVariantStock = useStore((s) => s.updateVariantStock);
  const moveHeldToAvailable = useStore((s) => s.moveHeldToAvailable);
  /** Правки только «в наличии», по id варианта; остальное (held) всегда из источника. */
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Refs строк для автопрокрутки раскрытого варианта в видимую зону шита. */
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /** Аккордеон: раскрыт всегда максимум один вариант. Повторный клик — закрыть. */
  const toggleExpanded = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  /** Раскрытый редактор всегда полностью виден: докручиваем шит к строке. */
  useEffect(() => {
    if (!expandedId) return;
    const el = rowRefs.current[expandedId];
    if (el && typeof el.scrollIntoView === 'function') {
      // tick — ждём монтирования .stock-item__editor
      const t = window.setTimeout(() => {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 30);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [expandedId]);

  /**
   * Строки выводятся из prop `variants` (server — источник истины) + локальных правок
   * «в наличии». Так после refetch/`inventory_reconcile` обновляются «в ожидании» и
   * неотредактированные «в наличии» без setState в effect (docs/20 §11).
   */
  const rows: StockRow[] = variants.map((v) => ({
    id: v.id,
    name: v.name,
    value: v.value,
    available: edits[v.id] ?? String(v.availableQuantity),
    held: v.heldQuantity,
  }));

  const setAvailable = (id: string, value: string) =>
    setEdits((prev) => ({ ...prev, [id]: value }));

  /** Перенос held → available — только через lifecycle-операцию сервера. */
  const moveHeld = async (id: string) => {
    if (movingId) return;
    setMovingId(id);
    setSaveError(null);
    try {
      await moveHeldToAvailable(id);
    } catch (e) {
      console.error('[inventory] move held failed', e);
      // held принадлежит активным заказам — освободить нельзя, пока заказ не
      // отменён/отказан (docs/21 §3.4, inventory_reconcile order-aware).
      const message = (e as Error).message ?? '';
      setSaveError(
        message.includes('INVENTORY_RESERVED_BY_ORDERS')
          ? 'Часть остатков зарезервирована активными заказами. Освободить их можно только после отмены или отказа заказа.'
          : 'Не удалось перенести остатки. Попробуйте ещё раз.',
      );
    } finally {
      setMovingId(null);
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const changes: Array<{ id: string; patch: UpdateVariantStockPatch }> = [];
      for (const row of rows) {
        const origin = variants.find((v) => v.id === row.id);
        const available = toInt(row.available);
        // Пишем только available; held не редактируется (docs/21 §3.4).
        if (!origin || available !== origin.availableQuantity) {
          changes.push({ id: row.id, patch: { availableQuantity: available } });
        }
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
      <div className="stock-sheet">
      <h2 className="sheet__title">Контроль остатков</h2>

      {rows.length === 0 ? (
        <div className="card__muted">Нет вариантов для управления остатками.</div>
      ) : (
        <div className="stock-list">
          {rows.map((row) => {
            const expanded = expandedId === row.id;
            return (
              <div
                className={`stock-item${expanded ? ' stock-item--open' : ''}`}
                key={row.id}
                ref={(el) => {
                  rowRefs.current[row.id] = el;
                }}
              >
                <button
                  type="button"
                  className="stock-item__row"
                  aria-expanded={expanded}
                  onClick={() => toggleExpanded(row.id)}
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
                      className={`stock-item__count${row.held > 0 ? ' stock-item__count--held' : ''}`}
                    >
                      <span className="stock-item__count-num">{row.held}</span>
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
                          data-testid={`stock-available-${row.id}`}
                          onChange={(e) => setAvailable(row.id, e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">В ожидании</span>
                        <input
                          className="field__input"
                          type="number"
                          value={row.held}
                          readOnly
                          aria-readonly="true"
                          data-testid={`stock-held-${row.id}`}
                        />
                      </label>
                    </div>
                    {row.held > 0 ? (
                      <button
                        type="button"
                        className="stock-row__move"
                        disabled={movingId === row.id}
                        onClick={() => void moveHeld(row.id)}
                      >
                        {movingId === row.id ? 'Переносим…' : 'Всё в наличии'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="char-add"
        onClick={() => {
          setAddOpen(true);
          setAddKey((k) => k + 1);
        }}
      >
        <Plus size={16} strokeWidth={2.5} />
        <span>Добавить вариант</span>
      </button>

      {saveError ? (
        <div style={{ marginTop: 8, color: '#FF3B30', fontSize: 13 }} role="alert">
          {saveError}
        </div>
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

      <AddVariantSheet
        key={addKey}
        open={addOpen}
        productId={productId}
        onClose={() => setAddOpen(false)}
      />
      </div>
    </BottomSheet>
  );
}
