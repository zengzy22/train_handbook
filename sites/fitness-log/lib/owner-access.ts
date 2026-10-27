export function ownerAccessStatus(userId: string | undefined | null, ownerId: string | undefined): 200 | 401 | 403 | 503 {
  if (!ownerId?.trim()) return 503;
  if (!userId) return 401;
  return userId === ownerId.trim() ? 200 : 403;
}
