import { describe, expect, it, vi } from "vitest";

import { getDriftBaselineRepository } from "@/lib/db/index";
import { MemoryDriftBaselineRepository } from "@/lib/db/memory";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    throw new Error("Cloudflare context unavailable");
  },
}));

describe("getDriftBaselineRepository", () => {
  it("uses one shared in-memory repository outside Cloudflare", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const first = await getDriftBaselineRepository();
    const second = await getDriftBaselineRepository();

    expect(first).toBeInstanceOf(
      MemoryDriftBaselineRepository,
    );

    expect(second).toBe(first);

    consoleError.mockRestore();
  });
});