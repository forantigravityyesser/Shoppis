import { Store } from 'lucide-react';
import { useImageFallback } from '../hooks/useImageFallback';

interface Props {
  bannerUrl: string | null;
  /** Alt/название магазина — баннер является смысловым изображением витрины. */
  storeName: string;
}

/**
 * Единственный баннер витрины на Главной: скруглённый, без текста/иконок/точек
 * и без переключений. Без изображения — брендовая заглушка. docs/13 §6.
 */
export default function HomeBanner({ bannerUrl, storeName }: Props) {
  const { failed, onError } = useImageFallback(bannerUrl);
  const showImage = Boolean(bannerUrl) && !failed;

  return (
    <div className="home-banner">
      {showImage ? (
        <img
          className="home-banner__img"
          src={bannerUrl as string}
          alt={storeName}
          decoding="async"
          onError={onError}
        />
      ) : (
        <div className="home-banner__placeholder" aria-hidden>
          <Store size={40} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
