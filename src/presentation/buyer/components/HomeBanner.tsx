import { Store } from 'lucide-react';
import SafeImage from '../../shared/components/SafeImage';

interface Props {
  bannerUrl: string | null;
  /** Alt/название магазина — баннер является смысловым изображением витрины. */
  storeName: string;
}

/**
 * Единственный баннер витрины на Главной: скруглённый, без текста/иконок/точек
 * и без переключений. Без изображения — брендовая заглушка. Баннер — главный
 * visual Home, поэтому грузится `eager`. docs/13 §6, docs/15 §7.2.
 */
export default function HomeBanner({ bannerUrl, storeName }: Props) {
  return (
    <div className="home-banner">
      <SafeImage
        src={bannerUrl}
        alt={storeName}
        className="home-banner__img"
        loading="eager"
        fallback={
          <div className="home-banner__placeholder" aria-hidden>
            <Store size={40} strokeWidth={1.5} />
          </div>
        }
      />
    </div>
  );
}
