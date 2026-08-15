import { describe, it, expect } from "vitest";
import { duplicateResult } from "@/lib/idempotency";

describe("duplicateResult — idempotencia de subidas", () => {
  it("devuelve resultado duplicado si ya está COMPLETED con driveFileId", () => {
    const r = duplicateResult({ status: "COMPLETED", driveFileId: "drive-123" });
    expect(r).not.toBeNull();
    expect(r?.driveFileId).toBe("drive-123");
    expect(r?.duplicated).toBe(true);
  });

  it("no considera duplicado si está PENDING", () => {
    expect(duplicateResult({ status: "PENDING", driveFileId: null })).toBeNull();
  });

  it("no considera duplicado si está COMPLETED pero sin driveFileId", () => {
    expect(duplicateResult({ status: "COMPLETED", driveFileId: null })).toBeNull();
  });

  it("maneja null/undefined", () => {
    expect(duplicateResult(null)).toBeNull();
    expect(duplicateResult(undefined)).toBeNull();
  });
});
