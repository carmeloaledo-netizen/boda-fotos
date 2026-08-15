import { describe, it, expect, vi } from "vitest";

// Aísla el cliente Prisma (no se usa en safeEqual) para no requerir engines.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));

import { safeEqual } from "@/lib/auth";

describe("safeEqual (comparación en tiempo constante)", () => {
  it("es true para strings iguales", () => {
    expect(safeEqual("secreto-largo", "secreto-largo")).toBe(true);
  });
  it("es false para strings distintos de igual longitud", () => {
    expect(safeEqual("aaaaaaa", "bbbbbbb")).toBe(false);
  });
  it("es false para longitudes distintas", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
