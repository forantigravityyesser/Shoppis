import { useStore } from '../store';

export function useAuth() {
  const user = useStore((s) => s.user);
  const context = useStore((s) => s.context);
  const storeId = useStore((s) => s.storeId);
  const authLoading = useStore((s) => s.authLoading);
  const authError = useStore((s) => s.authError);
  const initAuth = useStore((s) => s.initAuth);
  const setContext = useStore((s) => s.setContext);
  const setStoreId = useStore((s) => s.setStoreId);
  const checkOwnership = useStore((s) => s.checkOwnership);
  const createStore = useStore((s) => s.createStore);
  return { user, context, storeId, authLoading, authError, initAuth, setContext, setStoreId, checkOwnership, createStore };
}
