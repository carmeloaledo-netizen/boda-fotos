import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

/**
 * Flujo principal: un invitado abre el enlace del evento demo, selecciona una
 * foto, acepta el consentimiento y la sube (Drive está mockeado).
 *
 * PRECONDICIONES:
 *  - Base de datos migrada y sembrada (npm run seed).
 *  - La URL pública del evento demo (con su token) en E2E_EVENT_URL, o se
 *    deduce si defines E2E_EVENT_TOKEN.
 */

const SLUG = "laura-pablo-2026";

function makeJpeg(): string {
  // JPEG mínimo válido (SOI + APP0 + EOI) para pasar el sniff de MIME.
  const bytes = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  const file = path.join(os.tmpdir(), `e2e-${Date.now()}.jpg`);
  fs.writeFileSync(file, bytes);
  return file;
}

test("el invitado sube una foto correctamente", async ({ page }) => {
  const token = process.env.E2E_EVENT_TOKEN;
  const url =
    process.env.E2E_EVENT_URL ||
    (token ? `/e/${SLUG}?t=${token}` : null);

  test.skip(!url, "Define E2E_EVENT_URL o E2E_EVENT_TOKEN (token del evento demo)");

  await page.goto(url!);

  // La cabecera con el nombre de la pareja debe aparecer.
  await expect(page.getByRole("heading", { name: /Laura/i })).toBeVisible();

  // Selecciona el archivo.
  const file = makeJpeg();
  await page.setInputFiles('input[type="file"]', file);

  // Debe verse una miniatura/entrada en la cuadrícula.
  await expect(page.getByText(/terminadas/i)).toBeVisible();

  // Aceptar consentimiento.
  await page.getByRole("checkbox").check();

  // Subir.
  await page.getByRole("button", { name: /Subir fotograf/i }).click();

  // Mensaje final de agradecimiento.
  await expect(page.getByText(/Gracias/i)).toBeVisible({ timeout: 30_000 });

  fs.unlinkSync(file);
});
