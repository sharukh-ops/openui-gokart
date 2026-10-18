/**
 * Read-only access to the GoCart seed data (copied from web_open_ui/data/db.json).
 *
 * Phase one has no database: the JSON is imported once at module scope, which
 * Next.js treats as a predictable value. Only the fields the tools need are typed.
 */
import seed from "./db.json";

export interface DbUser {
  id: string;
  name: string;
  email: string;
  image: string;
  isAdmin?: boolean;
}

export interface DbStore {
  id: string;
  userId: string;
  name: string;
  status: string;
  isActive: boolean;
}

export interface DbProduct {
  id: string;
  storeId: string;
  name: string;
}

export interface DbOrder {
  id: string;
  storeId: string;
  total: number;
  createdAt: string;
}

export interface Db {
  currentUserId: string;
  users: DbUser[];
  stores: DbStore[];
  products: DbProduct[];
  orders: DbOrder[];
}

export const db: Db = seed as Db;
