import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { Area } from 'react-easy-crop';
import { Minimize2, ZoomIn } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { compressImage, cropToFile } from '../../../utils/image';
import '../image-crop.css';

/** Тяжёлый кроппер грузим только при первом открытии — отдельным чанком. */
const Cropper = lazy(() => import('react-easy-crop'));

/** Длинная сторона рабочей копии для редактирования (память/плавность). */
const EDIT_MAX_DIMENSION = 1600;

export interface ImageCropSheetProps {
  open: boolean;
  /** Исходный файл для кропа; null — sheet закрыт/нет данных. */
  file: File | null;
  /** Пропорция кадра (width / height): баннер 2.2, категория 1. */
  aspect: number;
  /** Заголовок sheet. */
  title: string;
  /** Ширина финального файла (px). */
  outputWidth: number;
  /** Подпись кнопки подтверждения. */
  confirmLabel?: string;
  /** Готовый обрезанный файл (нормализован и закодирован). */
  onConfirm: (file: File) => void;
  /** Отмена/закрытие — правки не применяются. */
  onClose: () => void;
  /** Вложенный sheet (поверх уже открытого, напр. редактора категории). */
  nested?: boolean;
}

interface PreparedSource {
  /** Исходный File, из которого приготовлена рабочая копия (для сопоставления). */
  origin: File;
  /** Рабочая копия ≤1600px — из неё же вырезаем финальный файл. */
  file: File;
  url: string;
}

/**
 * Модальный кроппер поверх `BottomSheet`: продавец двигает/зумит фото и видит,
 * какая область попадёт в баннер или обложку категории. Работает на рабочей
 * копии (≤1600px), финальный файл вырезается из неё же — координаты совпадают.
 */
export default function ImageCropSheet({
  open,
  file,
  aspect,
  title,
  outputWidth,
  confirmLabel = 'Готово',
  onConfirm,
  onClose,
  nested = false,
}: ImageCropSheetProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [source, setSource] = useState<PreparedSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<Area | null>(null);
  const urlRef = useRef<string | null>(null);

  // Готовим рабочую копию при появлении нового файла; всё состояние — в колбэках.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    compressImage(file, EDIT_MAX_DIMENSION)
      .then((edit) => {
        if (cancelled) return;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(edit);
        urlRef.current = url;
        setSource({ origin: file, file: edit, url });
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось обработать фото. Попробуйте другое.');
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Освобождаем последний blob-URL при размонтировании.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    areaRef.current = areaPixels;
  }, []);

  const confirm = async () => {
    const area = areaRef.current;
    if (!source || !area || busy) return;
    setBusy(true);
    setError(null);
    try {
      onConfirm(await cropToFile(source.file, area, outputWidth));
    } catch {
      setError('Не удалось обработать фото. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const preparing = file !== null && source?.origin !== file;
  const ready = source !== null && !preparing;
  const stageHeight = aspect >= 1.8 ? 200 : 320;
  const disabled = preparing || busy || !source;

  return (
    <BottomSheet open={open} onClose={busy ? () => {} : onClose} nested={nested}>
      <h2 className="sheet__title">{title}</h2>

      {ready ? (
        <div className="image-crop__stage" style={{ height: stageHeight }}>
          <Suspense
            fallback={
              <div className="image-crop__loading" style={{ height: stageHeight }}>
                Загрузка…
              </div>
            }
          >
            <Cropper
              image={source!.url}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              minZoom={1}
              maxZoom={3}
              zoomSpeed={0.8}
              restrictPosition
              objectFit="contain"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </Suspense>
        </div>
      ) : (
        <div className="image-crop__loading" style={{ height: stageHeight }}>
          {preparing ? 'Подготовка фото…' : 'Нет изображения'}
        </div>
      )}

      <div className="image-crop__zoom">
        <Minimize2 size={16} aria-hidden />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          disabled={disabled}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Масштаб"
        />
        <ZoomIn size={16} aria-hidden />
      </div>

      {error ? (
        <p className="prod-hint prod-hint--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="image-crop__actions">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
          Отмена
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void confirm()}
          disabled={disabled}
        >
          {busy ? 'Обработка…' : confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
