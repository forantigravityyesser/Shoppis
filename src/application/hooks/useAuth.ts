import { useStore } from '../store';

export function useAuth() {
  const user = useStore((s) => s.user);
  const role = useStore((s) => s.role);
  const storeId = useStore((s) => s.storeId);
  const authLoading = useStore((s) => s.authLoading);
  const authError = useStore((s) => s.authError);
  const initAuth = useStore((s) => s.initAuth);
  const setRole = useStore((s) => s.setRole);
  const setStoreId = useStore((s) => s.setStoreId);
  const checkOwnership = useStore((s) => s.checkOwnership);
  const createStore = useStore((s) => s.createStore);
  return { user, role, storeId, authLoading, authError, initAuth, setRole, setStoreId, checkOwnership, createStore };
}
