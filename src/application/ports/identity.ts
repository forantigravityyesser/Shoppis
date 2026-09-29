import type { ServerUser } from '../contracts/auth';

/**
 * Провайдер идентичности: единственное место, знающее, откуда берётся identity
 * (production — raw Telegram initData, dev — mock). null mock в production.
 */
export interface IdentityProvider {
  getRawInitData(): string;
  getDevServerUser(): ServerUser | null;
}
