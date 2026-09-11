import { describe, expect, it } from "vitest";
import {
  coalesceDashboardRequest,
  invalidateDashboardCache,
  readDashboardCache,
} from "@/lib/dashboard-request-cache";

describe("coalesceDashboardRequest", () => {
  it("reuses one in-flight loader and then serves cache", async () => {
    invalidateDashboardCache();
    let loads = 0;

    const loader = async () => {
      loads += 1;
      return { ok: true };
    };

    const [first, second] = await Promise.all([
      coalesceDashboardRequest("home", 5_000, loader),
      coalesceDashboardRequest("home", 5_000, loader),
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(loads).toBe(1);
    expect(readDashboardCache("home")).toEqual({ ok: true });

    invalidateDashboardCache("home");
    expect(readDashboardCache("home")).toBeNull();
  });
});
