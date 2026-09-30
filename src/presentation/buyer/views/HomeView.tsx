import { useStore } from '../../../application/store';
import StorefrontView from '../components/StorefrontView';

/** Публичная витрина, открытая по deep link `shop_<public_id>`. */
export default function HomeView() {
  const store = useStore((s) => s.viewedStore);
  const loading = useStore((s) => s.authLoading);

  return <StorefrontView store={store} loading={loading} />;
}
