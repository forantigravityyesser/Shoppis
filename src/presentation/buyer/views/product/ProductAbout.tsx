import { useState } from 'react';
import { useOutletContext } from 'react-router';
import type { StorefrontProductDetail } from '../../../../application/read-models/storefront-product';

/**
 * Порог длины описания, после которого включаем обрезку в 2 строки и «Подробнее».
 * Приблизительно две строки на ширине панели; короткие описания не обрезаем.
 */
const DESCRIPTION_CLAMP_THRESHOLD = 90;

interface Props {
  /**
   * Данные карточки. Обычно приходят через `<Outlet context={detail}>`; явный
   * prop нужен, когда shell держит «О товаре» под слоем Отзывов/Вопросов
   * (сохранение высоты и позиции скролла, docs/14 §3.3).
   */
  detail?: StorefrontProductDetail;
}

/**
 * Индексная вкладка Product Detail — «О товаре» (docs/14 §6): описание (обрезка
 * в 2 строки + «Подробнее»/«Свернуть») и характеристики (`attributes[]`; если не
 * заданы — блока нет). Данные — prop либо `<Outlet context={detail}>` из shell.
 */
export default function ProductAbout({ detail: detailProp }: Props = {}) {
  const contextDetail = useOutletContext<StorefrontProductDetail | undefined>();
  const detail = detailProp ?? contextDetail;
  const [expanded, setExpanded] = useState(false);

  if (!detail) return null;

  const description = detail.product.description.trim();
  const truncatable = description.length > DESCRIPTION_CLAMP_THRESHOLD;
  const clamp = truncatable && !expanded;

  return (
    <div className="pd-about" data-testid="product-about">
      {description ? (
        <div className="pd-about__desc">
          <p className={`pd-about__text${clamp ? ' pd-about__text--clamp' : ''}`}>{description}</p>
          {truncatable && !expanded ? (
            <button type="button" className="pd-about__more" onClick={() => setExpanded(true)}>
              … Подробнее
            </button>
          ) : null}
        </div>
      ) : null}

      {truncatable && expanded ? (
        <button type="button" className="pd-about__toggle" onClick={() => setExpanded(false)}>
          Свернуть
        </button>
      ) : null}

      {detail.attributes.length > 0 ? (
        <section className="pd-about__section">
          <h2 className="pd-about__heading">Характеристики</h2>
          <dl className="pd-about__attrs">
            {detail.attributes.map((attr, index) => (
              <div className="pd-about__attr" key={`${attr.name}-${index}`}>
                <dt>{attr.name}</dt>
                <dd>{attr.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
