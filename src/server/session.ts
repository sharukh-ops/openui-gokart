/**
 * Who is calling.
 *
 * Phase one has no login, the same as GoCart: the signed-in user is the seed's
 * `currentUserId` (user_1, an admin). Replace this with a real session lookup
 * before any real data is used.
 */
import { db } from "./data/db";
import type { ToolContext } from "./tools/registry";

export function getContext(): ToolContext {
  const user = db.users.find((u) => u.id === db.currentUserId);
  if (!user) throw new Error("Seed data has no current user");
  return { userId: user.id, role: user.isAdmin ? "admin" : "shopper" };
}
