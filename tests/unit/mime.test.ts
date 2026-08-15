import { describe, it, expect } from "vitest";
import {
  sniffImageMime,
  isAllowedMime,
  isAllowedExtension,
} from "@/lib/mime";

function bytes(...arr: number[]): Uint8Array {
  const u = new Uint8Array(32);
  u.set(arr);
  return u;
}

describe("sniffImageMime", () => {
  it("detecta JPEG por firma", () => {
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff))).toBe("image/jpeg");
  });
  it("detecta PNG por firma", () => {
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47))).toBe("image/png");
  });
  it("detecta WEBP (RIFF....WEBP)", () => {
    const u = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
    expect(sniffImageMime(u)).toBe("image/webp");
  });
  it("detecta HEIC por box ftyp+heic", () => {
    // 4 bytes tamaño, 'ftyp', 'heic'
    const u = bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63);
    expect(sniffImageMime(u)).toBe("image/heic");
  });
  it("rechaza contenido que no es imagen (p.ej. PDF)", () => {
    expect(sniffImageMime(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull();
  });
  it("rechaza un vídeo mp4 genérico (ftyp+isom)", () => {
    const u = bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d);
    expect(sniffImageMime(u)).toBeNull();
  });
});

describe("isAllowedMime / isAllowedExtension", () => {
  it("acepta los MIME de imagen soportados", () => {
    expect(isAllowedMime("image/jpeg")).toBe(true);
    expect(isAllowedMime("image/heif")).toBe(true);
    expect(isAllowedMime("video/mp4")).toBe(false);
  });
  it("valida extensiones permitidas", () => {
    expect(isAllowedExtension("foto.JPG")).toBe(true);
    expect(isAllowedExtension("foto.heic")).toBe(true);
    expect(isAllowedExtension("clip.mp4")).toBe(false);
    expect(isAllowedExtension("sinext")).toBe(false);
  });
});
