import { describe, it, expect } from "vitest";
import {
  uploadInitSchema,
  eventCreateSchema,
} from "@/lib/validation";

const validFile = {
  idempotencyKey: "6f9619ff-8b86-d011-b42d-00cf4fc964ff",
  originalName: "foto.jpg",
  sizeBytes: 1000,
  declaredMime: "image/jpeg",
};

describe("uploadInitSchema", () => {
  it("exige consentimiento === true", () => {
    const res = uploadInitSchema.safeParse({
      slug: "laura-pablo-2026",
      token: "x".repeat(30),
      files: [validFile],
      consent: false,
    });
    expect(res.success).toBe(false);
  });

  it("acepta un lote válido", () => {
    const res = uploadInitSchema.safeParse({
      slug: "laura-pablo-2026",
      token: "x".repeat(30),
      guestName: "Ana",
      files: [validFile],
      consent: true,
    });
    expect(res.success).toBe(true);
  });

  it("rechaza idempotencyKey no-UUID", () => {
    const res = uploadInitSchema.safeParse({
      slug: "s",
      token: "x".repeat(30),
      files: [{ ...validFile, idempotencyKey: "no-uuid" }],
      consent: true,
    });
    expect(res.success).toBe(false);
  });
});

describe("eventCreateSchema", () => {
  it("valida el formato del slug", () => {
    const bad = eventCreateSchema.safeParse({
      slug: "Laura Pablo 2026",
      coupleName: "Laura y Pablo",
      weddingDate: "2026-09-12",
      driveFolderId: "1AbCdEf",
      accentColor: "#8C7B6B",
    });
    expect(bad.success).toBe(false);
  });

  it("acepta datos correctos", () => {
    const ok = eventCreateSchema.safeParse({
      slug: "laura-pablo-2026",
      coupleName: "Laura y Pablo",
      weddingDate: "2026-09-12",
      driveFolderId: "1AbCdEf12345",
      accentColor: "#8C7B6B",
    });
    expect(ok.success).toBe(true);
  });

  it("rechaza color hex inválido", () => {
    const bad = eventCreateSchema.safeParse({
      slug: "x-y-2026",
      coupleName: "X e Y",
      weddingDate: "2026-09-12",
      driveFolderId: "1AbCdEf12345",
      accentColor: "rojo",
    });
    expect(bad.success).toBe(false);
  });
});
