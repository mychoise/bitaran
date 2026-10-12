export const ROLE_RANKS: Record<string, number> = {
  OWNER: 3,
  MANAGER: 2,
  STAFF: 1,
};

/**
 * Returns true only if actor's rank is strictly higher than target's rank.
 * OWNER (3) > MANAGER (2) > STAFF (1).
 */
export function canManage(actorRole: string, targetRole: string): boolean {
  const actorRank = ROLE_RANKS[actorRole] ?? 0;
  const targetRank = ROLE_RANKS[targetRole] ?? 0;
  return actorRank > targetRank;
}
