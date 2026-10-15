// checkout-identity.js — server-side resolution of the buyer's order-snapshot
// fields from the verified session identity (ORD-02, docs/22).
//
// The client never supplies its own Telegram username (docs/22 §4.4): the edge
// reads it from `telegram_identities` by the session user id. Missing
// identity/username or a failed lookup is non-fatal — checkout continues with
// `null` and never degrades.

/**
 * Resolve the buyer's Telegram username for the immutable order snapshot.
 *
 * @param {object} client - InsForge SDK admin client (`adminClient`).
 * @param {string} userId - authoritative user id from the verified session.
 * @returns {Promise<string|null>} username, or `null` when unavailable.
 */
export async function resolveCheckoutUsername(client, userId) {
  if (!userId) return null;
  try {
    const { data, error } = await client.database
      .from('telegram_identities')
      .select('username')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    const username = data?.username;
    return typeof username === 'string' && username.length > 0 ? username : null;
  } catch {
    return null;
  }
}
