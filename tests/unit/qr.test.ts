import { describe, it, expect } from "vitest";
import { buildPublicUrl, qrPngBuffer, qrSvgString } from "@/lib/qr";

describe("buildPublicUrl", () => {
  it("construye la URL con slug y token codificados", () => {
    const url = buildPublicUrl("https://fotos.example.com/", "laura-pablo-2026", "abc123");
    expect(url).toBe("https://fotos.example.com/e/laura-pablo-2026?t=abc123");
  });
  it("no apunta nunca a drive.google.com", () => {
    const url = buildPublicUrl("https://x.com", "s", "t");
    expect(url).not.toContain("drive.google.com");
  });
});

describe("generación de QR", () => {
  it("genera un PNG (empieza por la firma PNG)", async () => {
    const buf = await qrPngBuffer("https://x.com/e/s?t=t");
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
  });
  it("genera un SVG válido", async () => {
    const svg = await qrSvgString("https://x.com/e/s?t=t");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
