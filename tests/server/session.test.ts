import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeDb = vi.hoisted(() => ({
  currentUserId: "user_1",
  users: [] as Array<{ id: string; isAdmin?: boolean }>,
}));
vi.mock("@/server/data/db", () => ({ db: fakeDb }));

import { getContext } from "@/server/session";

describe("getContext", () => {
  beforeEach(() => {
    fakeDb.currentUserId = "user_1";
    fakeDb.users = [];
  });

  it("returns the current user as admin when they are an admin", () => {
    fakeDb.users = [{ id: "user_1", isAdmin: true }];
    expect(getContext()).toEqual({ userId: "user_1", role: "admin" });
  });

  it("returns a shopper role for a non-admin user", () => {
    fakeDb.users = [{ id: "user_1" }];
    expect(getContext()).toEqual({ userId: "user_1", role: "shopper" });
  });

  it("throws when the current user is missing", () => {
    fakeDb.currentUserId = "ghost";
    expect(() => getContext()).toThrow("no current user");
  });
});
