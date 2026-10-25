import { describe, expect, it } from "vitest";
import { gocartLibrary } from "@/openui/library";
import { serverLibrary } from "@/server/ai/library";

describe("server library", () => {
  it("describes the same components as the browser's library", () => {
    expect(serverLibrary.toJSONSchema()).toEqual(gocartLibrary.toJSONSchema());
    expect(serverLibrary.root).toBe(gocartLibrary.root);
  });

  it("writes the same prompt", () => {
    expect(serverLibrary.prompt()).toBe(gocartLibrary.prompt());
  });
});
