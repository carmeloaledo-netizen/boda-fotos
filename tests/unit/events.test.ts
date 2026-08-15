import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del cliente Prisma ANTES de importar el módulo bajo prueba.
// vi.hoisted garantiza que los mocks existen cuando se iza vi.mock.
const { findUnique, upsert } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique },
    upload: { upsert },
  },
}));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));

import { gatePublicEvent } from "@/lib/events";

const baseEvent = {
  id: "ev1",
  slug: "laura-pablo-2026",
  publicToken: "token-secreto-largo-1234567890",
  coupleName: "Laura y Pablo",
  weddingDate: new Date("2026-09-12"),
  driveFolderId: "folder",
  driveGuestsFolderId: null,
  isActive: true,
  closesAt: null as Date | null,
};

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset();
});

describe("gatePublicEvent — autorización pública", () => {
  it("404 si el evento no existe", async () => {
    findUnique.mockResolvedValue(null);
    const r = await gatePublicEvent("x", "y");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("403 si el token no coincide", async () => {
    findUnique.mockResolvedValue({ ...baseEvent });
    const r = await gatePublicEvent(baseEvent.slug, "token-incorrecto");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("403 si el evento está desactivado", async () => {
    findUnique.mockResolvedValue({ ...baseEvent, isActive: false });
    const r = await gatePublicEvent(baseEvent.slug, baseEvent.publicToken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/desactivad/i);
  });

  it("403 si el plazo ha caducado", async () => {
    findUnique.mockResolvedValue({
      ...baseEvent,
      closesAt: new Date(Date.now() - 1000),
    });
    const r = await gatePublicEvent(baseEvent.slug, baseEvent.publicToken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/finaliz/i);
  });

  it("ok con token correcto, activo y dentro de plazo", async () => {
    findUnique.mockResolvedValue({
      ...baseEvent,
      closesAt: new Date(Date.now() + 100000),
    });
    const r = await gatePublicEvent(baseEvent.slug, baseEvent.publicToken);
    expect(r.ok).toBe(true);
  });
});
